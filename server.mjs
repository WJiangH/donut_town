import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sendStaticFile } from "./web/static-files.mjs";
import { isPrivatePath } from "./web/private-path.mjs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { OutfitStore, equippedCharacter, validateOutfit, wardrobeSupported, wardrobeCharacters } from "./characters/wardrobe/store.mjs";
import { ShopStore, loadCatalog, walletFor, ownedIds, checkPurchase, equippedPet } from "./shop/store.mjs";
import { grantedDonuts } from "./shop/grants.mjs";
import { HouseStore, HOUSE_GRID, validateLayout, homeOwned } from "./house/store.mjs";
import { houseLuxury } from "./house/luxury.mjs";
import { ChatStore } from "./chats/store.mjs";
import { SocialStore, socialInput } from "./social/store.mjs";
import {LotteryBridge, verifyLotteryRequest} from './lottery/bridge.mjs';
import { ChatService } from "./chats/service.mjs";
import { ThemeStore } from "./town-themes/store.mjs";
import { ThemeService } from "./town-themes/service.mjs";
import { validateTheme } from "./town-themes/contract.mjs";
import { characterForMember, memberCharacterKey } from "./characters/catalog.mjs";
import { PresenceHub } from "./realtime/presence.mjs";
import { SlackClient } from "./slack/client.mjs";
import { activeInvitations, activeRoundId, getInvitation, answerInvitation, appearanceIndexFor, createInvitation, discardInvitation, invitationMessage, invitationSnapshotFor, invitationStateFor, pendingInvitationsFor, resolveInvitationActors, restoreInvitationSnapshots } from "./slack/invitations.mjs";
import { decodeLedgerSnapshot, encodeLedgerSnapshot } from "./slack/ledger.mjs";
import { UpstashInvitationStore } from "./slack/upstash-store.mjs";
import { buildSlackAuthorizeUrl, exchangeSlackCode, fetchSlackJwks, verifySlackIdToken } from "./slack/oidc.mjs";
import { createLaunchToken, createOAuthStateToken, createSessionToken, parseCookies, verifyOAuthStateToken, verifyTownToken, shouldRenewSession, SESSION_TTL_SECONDS } from "./slack/session.mjs";
import { verifySlackRequest } from "./slack/signature.mjs";
import { normalizeProfile, SheetProfileStore } from "./profile-store.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
await loadLocalEnv(join(root, ".env.local"));

const config = {
  botToken: process.env.SLACK_BOT_TOKEN || "",
  signingSecret: process.env.SLACK_SIGNING_SECRET || "",
  channelId: process.env.SLACK_CHANNEL_ID || "",
  ledgerChannelId: process.env.SLACK_LEDGER_CHANNEL_ID || "",
  sessionTtlSeconds: Math.max(3600, Number(process.env.SESSION_DAYS || 30) * 24 * 60 * 60) || SESSION_TTL_SECONDS,
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  clientId: process.env.SLACK_CLIENT_ID || "",
  clientSecret: process.env.SLACK_CLIENT_SECRET || "",
  stagingPassword: process.env.STAGING_PASSWORD || "",
  profileApiUrl: process.env.PROFILE_API_URL || "",
  profileApiSecret: process.env.PROFILE_API_SECRET || "",
  allowSend: process.env.SLACK_ALLOW_SEND === "true",
  port: Number(process.env.PORT || 4173),
  host: process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1")
};
if (Boolean(config.upstashUrl) !== Boolean(config.upstashToken)) {
  throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together.");
}
if (process.env.RENDER && !config.stagingPassword) {
  throw new Error("STAGING_PASSWORD is required on Render so Slack member data is not public.");
}
if (process.env.RENDER && (!config.botToken || !config.signingSecret || !config.channelId)) {
  throw new Error("SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, and SLACK_CHANNEL_ID are required on Render.");
}
const slack = config.botToken ? new SlackClient(config.botToken) : null;
const profileStore = new SheetProfileStore({ url: config.profileApiUrl, secret: config.profileApiSecret });
const invitationStore = new UpstashInvitationStore({ url: config.upstashUrl, token: config.upstashToken, namespace: config.channelId });
const outfitStore = new OutfitStore({ url: config.upstashUrl, token: config.upstashToken });
const shopStore = new ShopStore({ url: config.upstashUrl, token: config.upstashToken });
const shopCatalog = loadCatalog();
const socialStore = new SocialStore(shopStore, config.channelId);
const lotterySecret=process.env.LOTTERY_SYNC_SECRET || '';
const lotteryBridge=new LotteryBridge({social:socialStore,channelId:config.channelId,slack,
  keyFor:id=>memberCharacterKey(id,config.signingSecret),members:()=>getCachedChannelMembers(),allowSend:config.allowSend,
  onChanged:()=>{invitationReadAt=0;presenceHub.broadcast({type:'invitations-changed'});}
});
const houseStore = new HouseStore({ url: config.upstashUrl, token: config.upstashToken });
const chatService = new ChatService({
  invitationStore,
  store: new ChatStore({ url: config.upstashUrl, token: config.upstashToken, namespace: config.channelId }),
  keyFor: id => memberCharacterKey(id, config.signingSecret),
  currentRound: () => ({ roundId: activeRoundId(), snapshots: [...new Set(activeInvitations().map(item => item.inviterId))].map(invitationSnapshotFor) })
});
let memberCache = null;
let memberCacheExpiresAt = 0;
let memberSyncPromise = null;
const usedLaunchTokens = new Map();
const usedOAuthStates = new Map();
let slackJwksCache = null;
let expectedSlackTeamId = null;
let profileCache = null;
let profileCacheExpiresAt = 0;
let hydratedInvitationRoundId = null;
let invitationHydrationPromise = null;
let invitationReadAt = 0;
const ledgerMessageTsByInviter = new Map();
const realtimeServer = new WebSocketServer({ noServer: true, maxPayload: 512 });
const presenceHub = new PresenceHub();
const themeCatalog = JSON.parse(await readFile(join(root,'content/themes/catalog.json'),'utf8'));
for (const entry of themeCatalog) {
  const theme=validateTheme(JSON.parse(await readFile(join(root,entry.manifest),'utf8')));
  if (theme.id!==entry.id) throw new Error('Invalid theme catalog');
}
const themeService = new ThemeService({
  store: new ThemeStore({url:config.upstashUrl,token:config.upstashToken,namespace:config.channelId}),
  catalog:themeCatalog,
  memberFor:async id=>(await getCachedChannelMembers()).find(member=>member.id===id),
  keyFor:id=>memberCharacterKey(id,config.signingSecret),
  adminKeys:process.env.TOWN_ADMIN_KEYS || '',
  designatedKeys:JSON.parse(await readFile(join(root,'town-themes/admins.json'),'utf8')),
  onChanged:current=>presenceHub.broadcast({type:'town-theme',...current})
});

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (url.pathname === '/api/lottery') {
      response.setHeader('cache-control','no-store');
      if(request.method!=='POST')return sendJson(response,405,{error:'method_not_allowed'});
      const raw=await readBody(request);
      if(!verifyLotteryRequest(lotterySecret,request.headers,raw))return sendJson(response,401,{error:'lottery_auth_required'});
      if(!invitationStore.configured)return sendJson(response,503,{error:'lottery_storage_required'});
      try{return sendJson(response,200,await lotteryBridge.handle(JSON.parse(raw)));}
      catch(error){const known=['wrong_channel','invalid_round','invalid_round_window','round_conflict','round_not_registered','signup_still_open','invalid_pairs','invalid_action','already_booked','lottery_already_committed'];
        return sendJson(response,known.includes(error.code)?409:503,{error:known.includes(error.code)?error.code:'lottery_unavailable'});}
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      // `storage` says whether Upstash is wired up, so wardrobe and shop
      // failures can be diagnosed without signing in. No secret is exposed.
      return sendJson(response, 200, { ok: true, realtime: true, largeWorld: true, navigationV2: true, freeOverview: true, personalCharacters: "hmac-v1", storage: outfitStore.configured && shopStore.configured && houseStore.configured });
    }

    if (request.method === "GET" && url.pathname === "/enter") {
      return enterTown(url, response);
    }

    if (request.method === "GET" && url.pathname === "/auth/slack/start") {
      return await startSlackLogin(request, response);
    }

    if (["GET", "POST"].includes(request.method) && url.pathname === "/auth/slack/callback") {
      return finishSlackLogin(request, url, response);
    }

    if (url.pathname !== "/slack/interactions" && !isRequestAuthorized(request)) {
      response.writeHead(401, {
        "content-type": "text/plain; charset=utf-8",
        "www-authenticate": 'Basic realm="Donut Town testing", charset="UTF-8"'
      });
      response.end("Donut Town testing access required.");
      return;
    }

    renewSessionCookie(request, response);
    if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
      const origin=request.headers.origin;
      if ((origin && new URL(origin).host!==request.headers.host) || request.headers['sec-fetch-site']==='cross-site') return sendJson(response,403,{error:'same_origin_required'});
      if (!request.headers['content-type']?.startsWith('application/json')) return sendJson(response,415,{error:'json_required'});
    }

    if (url.pathname === '/api/town/theme') {
      response.setHeader('cache-control','private, no-store');
      const session=getSlackSession(request);
      try {
        if (request.method==='GET') return sendJson(response,200,await themeService.view(session?.sub));
        if (request.method!=='POST') return sendJson(response,405,{error:'method_not_allowed'});
        let body;
        try { body=JSON.parse(await readBody(request)); } catch { return sendJson(response,400,{error:'invalid_theme'}); }
        return sendJson(response,200,await themeService.change(session?.sub,body));
      } catch (error) {
        const statuses={slack_login_required:401,town_admin_required:403,invalid_theme:400,theme_conflict:409};
        return sendJson(response,statuses[error.message] || 503,{error:statuses[error.message] ? error.message : 'theme_unavailable'});
      }
    }

    if (request.method === "GET" && url.pathname === "/api/slack/status") {
      const session = getSlackSession(request);
      response.setHeader("cache-control", "private, no-store");
      return sendJson(response, 200, {
        configured: Boolean(config.botToken && config.channelId),
        interactivityConfigured: Boolean(config.signingSecret),
        oneClickConfigured: isSlackLoginConfigured(),
        currentUserConfigured: Boolean(session?.sub),
        realtimeConfigured: true,
        persistentStore: invitationStore.configured ? "upstash" : config.ledgerChannelId ? "slack" : "memory",
        ledgerConfigured: Boolean(config.ledgerChannelId),
        upstashConfigured: invitationStore.configured,
        sendEnabled: config.allowSend
      });
    }

    if (request.method === "GET" && url.pathname === "/api/slack/members") {
      if (!slack || !config.channelId) return missingConfiguration(response);
      await ensureInvitationStateHydrated();
      const members = await getCachedChannelMembers();
      const session = getSlackSession(request);
      const currentUserId = session?.sub;
      const currentUserFound = members.some(member => member.id === currentUserId);
      const outfits = await outfitStore.list();
      response.setHeader("cache-control", "private, no-store");
      return sendJson(response, 200, {
        total: members.length,
        currentUserConfigured: Boolean(currentUserId),
        currentUserFound,
        profileConnected: false,
        incomingInvitations: incomingFor(currentUserId),
        outgoingInvitations: currentUserId ? pendingInvitationsFor(currentUserId).map(invitation => ({
          id: invitation.id,
          inviteeId: invitation.inviteeId,
          createdAt: invitation.createdAt
        })) : [],
        members: members.map(member => ({
          ...member,
          donutCount: null,
          appearanceIndex: appearanceIndexFor(member.id),
          character: equippedCharacter(characterForMember(member.id, config.signingSecret), outfits[memberCharacterKey(member.id, config.signingSecret)]),
          characterKey: memberCharacterKey(member.id, config.signingSecret),
          isCurrentUser: member.id === currentUserId,
          ...invitationStateFor(member.id)
        }))
      });
    }

    if (request.method === "GET" && url.pathname === "/api/slack/invitation-states") {
      if (!slack || !config.channelId) return missingConfiguration(response);
      await ensureInvitationStateHydrated();
      const members = await getCachedChannelMembers();
      const session = getSlackSession(request);
      response.setHeader("cache-control", "private, no-store");
      return sendJson(response, 200, {
        incomingInvitations: incomingFor(session?.sub),
        states: Object.fromEntries(members.map(member => [member.id, invitationStateFor(member.id)])),
        outgoingInvitations: session?.sub ? pendingInvitationsFor(session.sub).map(invitation => ({
          id: invitation.id,
          inviteeId: invitation.inviteeId,
          createdAt: invitation.createdAt
        })) : []
      });
    }

    if (url.pathname === "/api/wardrobe") {
      response.setHeader("cache-control", "private, no-store");
      if (!outfitStore.configured) return sendJson(response, 503, { error: "outfit_store_unavailable" });
      if (request.method === "GET") {
        return sendJson(response, 200, { characters: wardrobeCharacters(await outfitStore.list()) });
      }
      if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });
      const session = getSlackSession(request);
      if (!session?.sub) return sendJson(response, 401, { error: "slack_login_required" });
      const members = await getCachedChannelMembers();
      if (!members.some(member => member.id === session.sub)) return sendJson(response, 403, { error: "member_not_found" });
      const character = characterForMember(session.sub, config.signingSecret);
      if (!wardrobeSupported(character)) return sendJson(response, 403, { error: "wardrobe_not_available" });
      let outfit;
      try {
        const body = JSON.parse(await readBody(request));
        if (Object.keys(body).length !== 1 || !body.outfit) throw new Error("invalid_outfit");
        outfit = validateOutfit(body.outfit, character);
      } catch { return sendJson(response, 400, { error: "invalid_outfit" }); }
      try {
        await outfitStore.save(memberCharacterKey(session.sub, config.signingSecret), outfit, character);
      } catch { return sendJson(response, 503, { error: "outfit_save_failed" }); }
      return sendJson(response, 200, { outfit, character: equippedCharacter(character, outfit) });
    }

    // The donut fountain is the shop. Donuts earned from pairings are the
    // currency, so a wallet is what you have earned less what you have spent.
    if (url.pathname === "/api/shop" || url.pathname === "/api/shop/purchase" || url.pathname === "/api/shop/equip") {
      response.setHeader("cache-control", "private, no-store");
      const session = getSlackSession(request);
      if (!session?.sub) return sendJson(response, 401, { error: "slack_login_required" });
      const members = await getCachedChannelMembers();
      const member = members.find(entry => entry.id === session.sub);
      if (!member) return sendJson(response, 403, { error: "member_not_found" });
      if (!shopStore.configured) return sendJson(response, 503, { error: "shop_store_unavailable" });
      const key = memberCharacterKey(session.sub, config.signingSecret);
      const earned = shopCatalog.starterDonuts + grantedDonuts(key) + (Number.isInteger(member.donutCount) ? member.donutCount : 0);
      let purse;
      try { purse = await shopStore.purse(key, shopCatalog); } catch { return sendJson(response, 503, { error: "shop_store_unavailable" }); }

      if (request.method === "GET" && url.pathname === "/api/shop") {
        return sendJson(response, 200, {
          currency: shopCatalog.currency,
          items: shopCatalog.items.filter(item => !item.starter),
          owned: ownedIds(purse),
          pet: equippedPet(purse, shopCatalog),
          wallet: walletFor({ earned, purse })
        });
      }
      if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });

      // Take a pet out, or leave it at home.
      if (url.pathname === "/api/shop/equip") {
        let petId;
        try {
          const body = JSON.parse(await readBody(request));
          if (Object.keys(body).length !== 1 || !("petId" in body)) throw new Error("invalid_pet");
          petId = body.petId === null ? null : String(body.petId);
        } catch { return sendJson(response, 400, { error: "invalid_pet" }); }
        if (petId && !equippedPet({ ...purse, pet: petId }, shopCatalog)) return sendJson(response, 409, { error: "pet_not_owned" });
        let next;
        try { next = await shopStore.equip(key, purse, petId); } catch { return sendJson(response, 503, { error: "shop_purchase_failed" }); }
        return sendJson(response, 200, { pet: equippedPet(next, shopCatalog), owned: ownedIds(next), wallet: walletFor({ earned, purse: next }) });
      }

      let item;
      try {
        const body = JSON.parse(await readBody(request));
        if (Object.keys(body).length !== 1 || typeof body.itemId !== "string") throw new Error("invalid_purchase");
        item = shopCatalog.items.find(entry => entry.id === body.itemId);
      } catch { return sendJson(response, 400, { error: "invalid_purchase" }); }
      const verdict = checkPurchase({ item, purse, earned });
      if (verdict.error) return sendJson(response, verdict.error === "item_not_found" ? 404 : 409, { error: verdict.error });
      let next;
      try { next = await shopStore.buy(key, item, purse, earned); } catch (error) { return sendJson(response, error.code ? 409 : 503, { error: error.code || "shop_purchase_failed" }); }
      return sendJson(response, 200, { item, owned: ownedIds(next), pet: equippedPet(next, shopCatalog), wallet: walletFor({ earned, purse: next }) });
    }

    // A member's own room: the decorations they own, and where they put them.
    if (url.pathname === "/api/house") {
      response.setHeader("cache-control", "private, no-store");
      const session = getSlackSession(request);
      if (!session?.sub) return sendJson(response, 401, { error: "slack_login_required" });
      const members = await getCachedChannelMembers();
      if (!members.some(entry => entry.id === session.sub)) return sendJson(response, 403, { error: "member_not_found" });
      if (!houseStore.configured) return sendJson(response, 503, { error: "house_store_unavailable" });
      const self = memberCharacterKey(session.sub, config.signingSecret);
      const key = url.searchParams.get('owner') || self;
      const owner = members.find(entry => memberCharacterKey(entry.id, config.signingSecret) === key);
      if (!owner) return sendJson(response,404,{error:'member_not_found'});
      if (request.method!=='GET' && key!==self) return sendJson(response,403,{error:'home_read_only'});
      let owned;
      try { owned = ownedIds(await shopStore.purse(key, shopCatalog)); } catch { return sendJson(response, 503, { error: "house_store_unavailable" }); }
      owned = homeOwned(owned, shopCatalog);
      const furniture = shopCatalog.items.filter(item => item.kind === "decoration");
      const rooms = [{id:'room-cottage',name:'Cozy Cottage',art:'/assets/donut-home-interior-v1.png'}, ...shopCatalog.items.filter(item => item.kind === 'room' && owned.includes(item.id))];

      if (request.method === "GET") {
        let layout;
        try { layout = await houseStore.load(key, { ownedIds: owned, catalog: shopCatalog }); } catch { return sendJson(response, 503, { error: "house_store_unavailable" }); }
        return sendJson(response, 200, { owner: {key,name:owner.displayName || owner.realName || "Neighbor"}, canDecorate: key===self, grid: HOUSE_GRID, layout, owned, furniture, rooms, luxury: houseLuxury(layout, { catalog: shopCatalog, ownedIds: owned }) });
      }
      if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });

      let layout;
      try {
        const body = JSON.parse(await readBody(request));
        if (Object.keys(body).length !== 1 || !body.layout) throw new Error("invalid_layout");
        layout = validateLayout(body.layout, { ownedIds: owned, catalog: shopCatalog });
      } catch { return sendJson(response, 400, { error: "invalid_layout" }); }
      try { await houseStore.save(key, layout); } catch { return sendJson(response, 503, { error: "house_save_failed" }); }
      return sendJson(response, 200, { owner: {key,name:owner.displayName || owner.realName || "Neighbor"}, canDecorate: key===self, grid: HOUSE_GRID, layout, owned, furniture, rooms, luxury: houseLuxury(layout, { catalog: shopCatalog, ownedIds: owned }) });
    }

    if (url.pathname === '/api/social' || url.pathname === '/api/messages') {
      response.setHeader('cache-control','private, no-store');
      const session=getSlackSession(request);
      if(!session?.sub)return sendJson(response,401,{error:'slack_login_required'});
      const members=await getCachedChannelMembers();
      const member=members.find(m=>m.id===session.sub);
      if(!member)return sendJson(response,403,{error:'member_not_found'});
      if(!shopStore.configured)return sendJson(response,503,{error:'social_unavailable'});
      const self=memberCharacterKey(member.id,config.signingSecret);
      const messaging=url.pathname==='/api/messages';
      const people=new Map(members.map(m=>[memberCharacterKey(m.id,config.signingSecret),{key:memberCharacterKey(m.id,config.signingSecret),name:m.displayName||m.realName||'Neighbor',avatar:m.avatarUrl||null}]));
      const person=key=>people.get(key)||{key:null,name:'Former neighbor',avatar:null};
      const decorate=e=>({...e,sender:person(e.from),recipient:person(e.to)});
      try {
        if(!['GET','POST'].includes(request.method))return sendJson(response,405,{error:'method_not_allowed'});
        const body=request.method==='POST'?JSON.parse(await readBody(request)):{};
        const peer=messaging?(url.searchParams.get('peer')||body.peer):(url.searchParams.get('home')||body.home||self);
        if(peer && !people.has(peer))return sendJson(response,404,{error:'member_not_found'});
        if(request.method==='POST') {
          if(!peer)return sendJson(response,400,{error:'choose_a_neighbor'});
          const event=socialInput(body,{self,peer,messaging});
          await socialStore.event(event,shopCatalog.starterDonuts+grantedDonuts(self)+(Number.isInteger(member.donutCount)?member.donutCount:0));
          return sendJson(response,201,{ok:true});
        }
        if(messaging)return sendJson(response,200,{self,peer:peer?person(peer):null,messages:(await socialStore.messages(self,peer)).map(decorate)});
        await socialStore.visit(peer,self);
        const [home,purse]=await Promise.all([socialStore.home(peer),shopStore.purse(self,shopCatalog)]);
        return sendJson(response,200,{self,owner:person(peer),notes:home.notes.map(decorate),visitors:home.visitors.map(e=>({...e,sender:person(e.from)})),wallet:walletFor({earned:shopCatalog.starterDonuts+grantedDonuts(self)+(Number.isInteger(member.donutCount)?member.donutCount:0),purse})});
      } catch(error) {
        const code=error.code||error.message;
        const known=['invalid_interaction','choose_a_neighbor','invalid_message','invalid_amount','not_enough_donuts','try_again_later','request_conflict'];
        return sendJson(response,known.includes(code)?400:503,{error:known.includes(code)?code:'social_unavailable'});
      }
    }

    if (url.pathname === '/api/slack/invitations/respond') {
      response.setHeader('cache-control','private, no-store');
      const session=getSlackSession(request);
      if(!session?.sub)return sendJson(response,401,{error:'slack_login_required'});
      if(request.method!=='POST')return sendJson(response,405,{error:'method_not_allowed'});
      try {
        const body=JSON.parse(await readBody(request));
        if(!['accepted','declined'].includes(body.status)||typeof body.id!=='string')return sendJson(response,400,{error:'invalid_invitation'});
        const members=await getCachedChannelMembers();
        if(!members.some(m=>m.id===session.sub))return sendJson(response,403,{error:'member_not_found'});
        const result=await respondToInvitation(body.id,body.status,session.sub);
        if(!result)return sendJson(response,409,{error:'invitation_not_active'});
        // Acceptance is already durable. A notification failure must not undo it.
        if(config.allowSend&&slack&&!result.duplicateResponse) {
          void notifyInviter(result,body.status).catch(()=>console.error('Invitation notification failed'));
          void updateInvitationCard(result,body.status).catch(()=>console.error('Invitation card update failed'));
        }
        return sendJson(response,200,{ok:true,status:body.status});
      }catch(error){return sendJson(response,error.code?409:503,{error:error.code||'invitation_unavailable'});}
    }

    if (url.pathname === "/api/profile/chats" || url.pathname === "/api/profile/chats/confirm") {
      response.setHeader("cache-control", "private, no-store");
      const session = getSlackSession(request);
      if (!session?.sub) return sendJson(response, 401, { error: "slack_login_required" });
      const confirming = url.pathname.endsWith("/confirm");
      if (request.method !== (confirming ? "POST" : "GET")) return sendJson(response, 405, { error: "method_not_allowed" });
      let chatId;
      if (confirming) {
        try {
          const body = JSON.parse(await readBody(request));
          if (Object.keys(body).length !== 1 || !/^[a-f0-9]{64}$/.test(body.chatId || "")) throw new Error();
          chatId = body.chatId;
        } catch { return sendJson(response, 400, { error: "invalid_chat" }); }
      }
      try {
        await ensureInvitationStateHydrated();
        const members = await getCachedChannelMembers();
        const data = confirming ? await chatService.confirm(session.sub, chatId, members) : await chatService.profile(session.sub, members);
        return sendJson(response, 200, data);
      } catch (error) {
        if (error.message === "member_not_found") return sendJson(response, 403, { error: "member_not_found" });
        if (error.message === "chat_not_found") return sendJson(response, 404, { error: "chat_not_found" });
        return sendJson(response, 503, { error: "chat_history_unavailable" });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/profile") {
      const session = getSlackSession(request);
      if (!session?.sub) return sendJson(response, 401, { error: "slack_login_required" });
      if (!profileStore.configured) return sendJson(response, 503, { error: "profile_store_not_configured" });
      const members = await getCachedChannelMembers();
      if (!members.some(member => member.id === session.sub)) {
        return sendJson(response, 403, { error: "profile_member_not_found" });
      }
      const body = JSON.parse(await readBody(request));
      const profile = await profileStore.update(session.sub, normalizeProfile(body));
      profileCache = null;
      profileCacheExpiresAt = 0;
      return sendJson(response, 200, { ok: true, profile });
    }

    if (request.method === "POST" && url.pathname === "/api/slack/invitations") {
      const session = getSlackSession(request);
      if (!session?.sub) return sendJson(response, 401, { error: "slack_login_required" });
      await ensureInvitationStateHydrated(true);
      const body = JSON.parse(await readBody(request));
      const members = await getCachedChannelMembers();
      const selfTest = body.selfTest === true;
      const invitationInput = resolveInvitationActors({
        sessionUserId: session.sub,
        inviteeId: selfTest ? session.sub : body.inviteeId,
        priority: body.priority,
        members,
        allowSelfInvite: selfTest
      });
      if (!selfTest && invitationStateFor(invitationInput.inviterId).status === "booked") {
        return sendJson(response, 409, { error: "inviter_already_booked" });
      }
      if (!selfTest && invitationStateFor(invitationInput.inviteeId).status === "booked") {
        return sendJson(response, 409, { error: "invitee_already_booked" });
      }
      const pending = pendingInvitationsFor(session.sub);
      if (pending.some(invitation => invitation.inviteeId === invitationInput.inviteeId)) {
        return sendJson(response, 409, { error: "invitation_already_pending" });
      }
      if (pending.length >= 3) return sendJson(response, 409, { error: "pending_invitation_limit" });
      const invitation = createInvitation(invitationInput);
      const message = invitationMessage(invitation);
      if (!config.allowSend) {
        discardInvitation(invitation.id);
        return sendJson(response, 200, { ok: true, dryRun: true, invitation, message });
      }
      if (!slack) return missingConfiguration(response);
      try {
        if (!invitation.selfTest) {
          if(invitationStore.configured) restoreInvitationSnapshots(await socialStore.invitation('add',invitation,activeRoundId()));
          else await persistInvitationSnapshots([invitation.inviterId]);
        }
        const channel = await slack.openDm(invitation.inviteeId);
        const delivered=await slack.postMessage(channel, message);
        if(!invitation.selfTest&&invitationStore.configured&&delivered.ts){
          // Message delivery has succeeded; missing card metadata must not cancel a valid invitation.
          await socialStore.invitation('delivery',{id:invitation.id,messageChannel:channel,messageTs:delivered.ts},activeRoundId()).catch(()=>console.error('Invitation card reference unavailable'));
        }
        return sendJson(response, 201, { ok: true, dryRun: false, invitation });
      } catch (error) {
        discardInvitation(invitation.id);
        if (!invitation.selfTest) {
          await (invitationStore.configured ? socialStore.invitation('remove', {id:invitation.id}, activeRoundId()).then(restoreInvitationSnapshots) : persistInvitationSnapshots([invitation.inviterId])).catch(()=>console.error('Invitation delivery rollback failed'));
        }
        throw error;
      }
    }

    if (request.method === "POST" && url.pathname === "/slack/interactions") {
      const rawBody = await readBody(request);
      const valid = verifySlackRequest({
        signingSecret: config.signingSecret,
        timestamp: request.headers["x-slack-request-timestamp"],
        signature: request.headers["x-slack-signature"],
        rawBody
      });
      if (!valid) return sendJson(response, 401, { ok: false, error: "invalid_signature" });
      const encodedPayload = new URLSearchParams(rawBody).get("payload");
      if (!encodedPayload) return sendJson(response, 400, { ok: false, error: "missing_payload" });
      const payload = JSON.parse(encodedPayload);
      response.writeHead(200);
      response.end();
      const publicBaseUrl = getPublicBaseUrl();
      queueMicrotask(() => handleSlackAction(payload, publicBaseUrl).catch(error => console.error("Slack action failed", error)));
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") return sendJson(response, 404, { error: "not_found" });
    return serveStatic(url.pathname, response, request);
  } catch (error) {
    console.error(error);
    return sendJson(response, error.name === "SyntaxError" ? 400 : 500, { error: error.message });
  }
});

server.on("upgrade", (request, socket, head) => {
  let url;
  let origin;
  try {
    url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    origin = new URL(request.headers.origin || "invalid:");
  } catch {
    socket.destroy();
    return;
  }
  if (url.pathname !== "/realtime") {
    socket.destroy();
    return;
  }
  if (origin.host !== request.headers.host) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  const session = getSlackSession(request);
  if (!session?.sub) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  realtimeServer.handleUpgrade(request, socket, head, webSocket => {
    realtimeServer.emit("connection", webSocket, request, session);
  });
});

realtimeServer.on("connection", (webSocket, request, session) => {
  webSocket.isAlive = true;
  webSocket.on("pong", () => {
    webSocket.isAlive = true;
  });
  presenceHub.connect(webSocket, session.sub);
});

const realtimeHeartbeat = setInterval(() => {
  for (const webSocket of realtimeServer.clients) {
    if (!webSocket.isAlive) {
      webSocket.terminate();
      continue;
    }
    webSocket.isAlive = false;
    webSocket.ping();
  }
}, 15000);
realtimeHeartbeat.unref();

function enterTown(url, response) {
  const launch = verifyTownToken(url.searchParams.get("token"), {
    signingSecret: config.signingSecret,
    expectedType: "launch",
    expectedChannelId: config.channelId
  });
  if (!launch || usedLaunchTokens.has(launch.jti)) {
    response.writeHead(401, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("This Donut Town link is invalid or expired. Return to Slack and click Enter Donut Town again.");
    return;
  }
  usedLaunchTokens.set(launch.jti, launch.exp);
  pruneUsedLaunchTokens();
  const session = createSessionToken({
    userId: launch.sub,
    channelId: launch.channel,
    signingSecret: config.signingSecret,
    ttlSeconds: config.sessionTtlSeconds
  });
  response.writeHead(302, {
    location: "/",
    "cache-control": "no-store",
    "set-cookie": sessionCookie(session)
  });
  response.end();
}

async function getCachedChannelMembers() {
  if (memberCache && Date.now() < memberCacheExpiresAt) return memberCache;
  if (memberSyncPromise) return memberSyncPromise;
  memberSyncPromise = slack.listChannelMembers(config.channelId)
    .then(members => {
      memberCache = members;
      memberCacheExpiresAt = Date.now() + 5 * 60 * 1000;
      return members;
    })
    .catch(error => {
      if (memberCache) return memberCache;
      throw error;
    })
    .finally(() => {
      memberSyncPromise = null;
    });
  return memberSyncPromise;
}

function incomingFor(userId) {
  return activeInvitations().filter(i=>i.inviteeId===userId&&i.status==='pending').map(i=>({id:i.id,inviterId:i.inviterId,createdAt:i.createdAt}));
}

async function respondToInvitation(id,status,responder) {
  // Self-test invitations never enter persistent pair/reward storage.
  const test=getInvitation(id);
  if(test?.selfTest)return answerInvitation(id,status,responder);
  await ensureInvitationStateHydrated(true);
  const invitation=getInvitation(id);
  if(!invitation||invitation.inviteeId!==responder)return null;
  const members=await getCachedChannelMembers();
  if(![responder,invitation.inviterId].every(id=>members.some(m=>m.id===id)))return null;
  if(invitationStore.configured) {
    const keys=[invitation.inviterId,responder].map(id=>memberCharacterKey(id,config.signingSecret));
    let snapshots;
    try{snapshots=await socialStore.invitation('answer',{id,responder,inviter:invitation.inviterId,status},activeRoundId(),keys);}
    catch(error){if(['invitation_not_active','already_booked'].includes(error.code))return null;throw error;}
    restoreInvitationSnapshots(snapshots);
    getInvitation(id).duplicateResponse=!snapshots.changed;
  }else{
    if(status==='accepted')throw Error('shop_store_unavailable');
    const answer=answerInvitation(id,status,responder);
    if(!answer)return null;
    await persistInvitationSnapshots(activeInvitations().map(i=>i.inviterId));
  }
  presenceHub.broadcast({type:'invitations-changed'});
  if(status==='accepted'&&lotterySecret)void lotteryBridge.notify().catch(()=>console.error('Pair thread notification will retry on the next Lottery tick'));
  return getInvitation(id);
}

async function ensureInvitationStateHydrated(force=false) {
  if (!invitationStore.configured && !config.ledgerChannelId) return;
  const roundId = activeRoundId();
  if(force && invitationHydrationPromise)await invitationHydrationPromise;
  // Roster polls share a one-second snapshot; writes always read durable state.
  if (hydratedInvitationRoundId === roundId && (!invitationStore.configured || (!force && Date.now()-invitationReadAt<1000))) return;
  if (invitationHydrationPromise) return invitationHydrationPromise;
  invitationHydrationPromise = (async () => {
    if (invitationStore.configured) {
      const snapshots = await invitationStore.load(roundId);
      if (snapshots !== null || !config.ledgerChannelId) {
        restoreInvitationSnapshots(snapshots || []);
        hydratedInvitationRoundId = roundId;
        invitationReadAt=Date.now();
        return;
      }
    }
    if (config.ledgerChannelId) {
      const messages = await slack.listRecentMessages(config.ledgerChannelId, 200);
      const snapshots = new Map();
      ledgerMessageTsByInviter.clear();
      for (const message of messages) {
        const snapshot = decodeLedgerSnapshot(message.text);
        if (!snapshot || snapshot.roundId !== roundId || snapshots.has(snapshot.inviterId)) continue;
        snapshots.set(snapshot.inviterId, snapshot);
        ledgerMessageTsByInviter.set(snapshot.inviterId, message.ts);
      }
      restoreInvitationSnapshots([...snapshots.values()]);
      if (invitationStore.configured && snapshots.size) {
        await invitationStore.save(roundId, [...snapshots.values()]);
      }
    }
    hydratedInvitationRoundId = roundId;
  })().finally(() => {
    invitationHydrationPromise = null;
  });
  return invitationHydrationPromise;
}

async function persistInvitationSnapshots(inviterIds) {
  if (!invitationStore.configured && !config.ledgerChannelId) return;
  await ensureInvitationStateHydrated();
  if (invitationStore.configured) {
    const allInviterIds = new Set(activeInvitations().map(invitation => invitation.inviterId));
    await invitationStore.save(activeRoundId(), [...allInviterIds].map(invitationSnapshotFor));
    return;
  }
  for (const inviterId of new Set(inviterIds)) {
    const message = { text: encodeLedgerSnapshot(invitationSnapshotFor(inviterId)) };
    const existingTs = ledgerMessageTsByInviter.get(inviterId);
    const result = existingTs
      ? await slack.updateMessage(config.ledgerChannelId, existingTs, message)
      : await slack.postMessage(config.ledgerChannelId, message);
    ledgerMessageTsByInviter.set(inviterId, result.ts || existingTs);
  }
}

async function getCachedProfiles() {
  if (!profileStore.configured) return { connected: false, profiles: {} };
  if (profileCache && Date.now() < profileCacheExpiresAt) {
    return { connected: true, profiles: profileCache };
  }
  try {
    profileCache = await profileStore.list();
    profileCacheExpiresAt = Date.now() + 5 * 60 * 1000;
    return { connected: true, profiles: profileCache };
  } catch (error) {
    console.error("Profile sheet sync failed", error);
    return { connected: false, profiles: profileCache || {} };
  }
}

async function handleSlackAction(payload, publicBaseUrl) {
  if (!slack || payload.type !== "block_actions") return;
  const action = payload.actions?.[0];
  if (!action) return;
  if (action.action_id === "enter_donut_town") {
    // New entrance messages carry a URL and the browser completes Slack OpenID.
    // Keep the private-link response only for entrance messages posted before
    // the one-click URL was added.
    if (action.url || action.value === "one_click_oauth") return;
    const userId = payload.user?.id;
    const channelId = payload.channel?.id;
    if (!userId || !channelId) return;
    const members = await getCachedChannelMembers();
    if (channelId !== config.channelId || !members.some(member => member.id === userId)) {
      await slack.call("chat.postEphemeral", {
        channel: channelId,
        user: userId,
        text: "Donut Town is currently limited to members of the testing channel."
      });
      return;
    }
    const token = createLaunchToken({
      userId,
      channelId,
      signingSecret: config.signingSecret
    });
    await slack.call("chat.postEphemeral", {
      channel: channelId,
      user: userId,
      text: "Your private Donut Town entrance is ready.",
      blocks: [{
        type: "section",
        text: { type: "mrkdwn", text: "Your private entrance is ready. This link expires in 5 minutes. :doughnut:" },
        accessory: {
          type: "button",
          action_id: "open_donut_town_url",
          text: { type: "plain_text", text: "Enter Donut Town" },
          style: "primary",
          url: `${publicBaseUrl}/enter?token=${encodeURIComponent(token)}`
        }
      }]
    });
    return;
  }
  if (!["donut_accept", "donut_decline"].includes(action.action_id)) return;
  const status = action.action_id === "donut_accept" ? "accepted" : "declined";
  let invitation;
  try{invitation=await respondToInvitation(action.value,status,payload.user.id);}
  catch{await slack.postMessage(payload.channel.id,{text:'Could not save your answer. Please try the invitation button again.'});return;}
  if (!invitation) {
    await slack.postMessage(payload.channel.id, { text: "This Donut invitation is no longer active." });
    return;
  }
  const responderMessage = status === "accepted"
    ? invitation.selfTest
      ? "Self-test accepted. A real acceptance will mark both people as booked. :doughnut:"
      : "Accepted! You are paired this week. You each earned 5 donuts in Town. :doughnut:"
    : invitation.selfTest
      ? "Self-test declined. A real decline will leave both people available."
      : "No problem. Donut Town will leave you available for another week.";
  const card={...invitation,messageChannel:payload.channel?.id||invitation.messageChannel,messageTs:payload.message?.ts||payload.container?.message_ts||invitation.messageTs};
  if(card.messageChannel&&card.messageTs)await updateInvitationCard(card,status);
  else await slack.postMessage(payload.channel.id, { text: responderMessage });
  if (invitation.selfTest) return;
  if(!invitation.duplicateResponse)await notifyInviter(invitation, status);
}

async function updateInvitationCard(invitation,status) {
  if(!invitation.messageChannel||!invitation.messageTs)return;
  const text=invitation.selfTest ? `Self-test ${status}. No rewards issued.` : status==='accepted'
    ? `Paired! <@${invitation.inviterId}> and <@${invitation.inviteeId}> are booked for this week. You each earned 5 donuts. :doughnut:`
    : 'This Donut invitation was declined. You can choose another neighbor in Town.';
  await slack.updateMessage(invitation.messageChannel,invitation.messageTs,{text,blocks:[{type:'section',text:{type:'mrkdwn',text}}]});
}

async function notifyInviter(invitation,status) {
  const inviterChannel = await slack.openDm(invitation.inviterId);
  await slack.postMessage(inviterChannel, {
    text: status === "accepted"
      ? `<@${invitation.inviteeId}> accepted your Donut chat invitation.`
      : `<@${invitation.inviteeId}> is not available for a Donut chat this week.`
  });
}

async function startSlackLogin(request, response) {
  if (!isSlackLoginConfigured()) {
    return sendAuthError(response, 503, "One-click Slack entry is not configured yet.");
  }
  if (getSlackSession(request)) return redirect(response, "/");
  const state = createOAuthStateToken({ signingSecret: config.signingSecret });
  const statePayload = verifyOAuthStateToken(state, { signingSecret: config.signingSecret });
  const redirectUri = `${getPublicBaseUrl()}/auth/slack/callback`;
  const authorizeUrl = buildSlackAuthorizeUrl({
    clientId: config.clientId,
    redirectUri,
    state,
    nonce: statePayload.nonce,
    team: await getExpectedSlackTeamId()
  });
  response.writeHead(302, {
    location: authorizeUrl,
    "cache-control": "no-store",
    "set-cookie": oauthStateCookie(state)
  });
  response.end();
}

async function finishSlackLogin(request, url, response) {
  const clearStateCookie = oauthStateCookie("", 0);
  try {
    if (!isSlackLoginConfigured()) throw new Error("Slack OpenID is not configured");
    const params = request.method === "POST" ? new URLSearchParams(await readBody(request)) : url.searchParams;
    if (params.get("error")) throw new Error(`Slack authorization was denied: ${params.get("error")}`);
    const code = params.get("code");
    const state = params.get("state");
    const stateCookie = parseCookies(request.headers.cookie).donut_oauth_state;
    if (!code || !state || !stateCookie || !safeEqualText(state, stateCookie)) throw new Error("Slack authorization state does not match");
    const statePayload = verifyOAuthStateToken(state, { signingSecret: config.signingSecret });
    if (!statePayload || usedOAuthStates.has(statePayload.jti)) throw new Error("Slack authorization state is invalid or expired");

    const redirectUri = `${getPublicBaseUrl()}/auth/slack/callback`;
    const tokenResponse = await exchangeSlackCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri
    });
    const claims = verifySlackIdToken(tokenResponse.id_token, {
      clientId: config.clientId,
      nonce: statePayload.nonce,
      jwks: await getCachedSlackJwks()
    });
    const userId = claims["https://slack.com/user_id"] || claims.sub;
    const teamId = claims["https://slack.com/team_id"];
    if (!/^[UW][A-Z0-9]+$/.test(userId || "")) throw new Error("Slack user ID is invalid");
    if (!teamId || teamId !== await getExpectedSlackTeamId()) throw new Error("This Slack account belongs to a different workspace");
    const members = await getCachedChannelMembers();
    if (!members.some(member => member.id === userId)) throw new Error("This Slack account is not in the Donut testing channel");

    usedOAuthStates.set(statePayload.jti, statePayload.exp);
    pruneUsedTokens(usedOAuthStates);
    const session = createSessionToken({ userId, channelId: config.channelId, signingSecret: config.signingSecret, ttlSeconds: config.sessionTtlSeconds });
    response.writeHead(302, {
      location: "/",
      "cache-control": "no-store",
      "set-cookie": [clearStateCookie, sessionCookie(session)]
    });
    response.end();
  } catch (error) {
    console.error("Slack login failed", error);
    response.setHeader("set-cookie", clearStateCookie);
    return sendAuthError(response, 401, "Slack could not confirm access to this Donut Town.");
  }
}

function isSlackLoginConfigured() {
  return Boolean(slack && config.signingSecret && config.channelId && config.clientId && config.clientSecret);
}

async function getCachedSlackJwks() {
  if (slackJwksCache && Date.now() < slackJwksCache.expiresAt) return slackJwksCache.keys;
  const keys = await fetchSlackJwks();
  slackJwksCache = { keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return keys;
}

async function getExpectedSlackTeamId() {
  if (expectedSlackTeamId) return expectedSlackTeamId;
  const result = await slack.call("auth.test");
  if (!result.team_id) throw new Error("Slack auth.test did not return a team ID");
  expectedSlackTeamId = result.team_id;
  return expectedSlackTeamId;
}

function missingConfiguration(response) {
  return sendJson(response, 503, { error: "slack_not_configured", required: ["SLACK_BOT_TOKEN", "SLACK_CHANNEL_ID"] });
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  response.end(body);
}

function sendAuthError(response, statusCode, message) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  response.end(`${message}\n\nReturn to Slack and try Enter Donut Town again.`);
}

function redirect(response, location) {
  response.writeHead(302, { location, "cache-control": "no-store" });
  response.end();
}

async function serveStatic(pathname, response, request) {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  if (isPrivatePath(relativePath)) return sendJson(response, 404, { error: "not_found" });
  const filePath = resolve(root, normalize(relativePath));
  if (!filePath.startsWith(resolve(root) + "/")) return sendJson(response, 403, { error: "forbidden" });
  if (filePath.startsWith(resolve(root, "art-source") + "/")) return sendJson(response, 404, { error: "not_found" });
  try {
    await sendStaticFile(request, response, filePath, contentType(extname(filePath)));
  } catch {
    if (response.headersSent) { response.destroy(); return; }
    sendJson(response, 404, { error: "not_found" });
  }
}

function contentType(extension) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  })[extension] || "application/octet-stream";
}

async function loadLocalEnv(filePath) {
  try {
    const contents = await readFile(filePath, "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function isRequestAuthorized(request) {
  if (getSlackSession(request)) return true;
  if (!config.stagingPassword) return true;
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Basic ")) return false;
  const expected = Buffer.from(`donut:${config.stagingPassword}`);
  let actual;
  try {
    actual = Buffer.from(authorization.slice(6), "base64");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function getSlackSession(request) {
  const token = parseCookies(request.headers.cookie).donut_town_session;
  return verifyTownToken(token, {
    signingSecret: config.signingSecret,
    expectedType: "session",
    expectedChannelId: config.channelId
  });
}

function getPublicBaseUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.RENDER_EXTERNAL_HOSTNAME) return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  return `http://127.0.0.1:${config.port}`;
}

function oauthStateCookie(value, maxAge = 10 * 60) {
  const crossSite = getPublicBaseUrl().startsWith("https:") ? "; Secure; SameSite=None" : "; SameSite=Lax";
  return `donut_oauth_state=${value}; Path=/auth/slack/callback; HttpOnly${crossSite}; Max-Age=${maxAge}`;
}

function sessionCookie(value) {
  const secure = getPublicBaseUrl().startsWith("https:") ? "; Secure" : "";
  return `donut_town_session=${value}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${config.sessionTtlSeconds}`;
}

// Keep an active member signed in: once their session is past halfway, hand
// back a fresh one on the way through.
function renewSessionCookie(request, response) {
  const session = getSlackSession(request);
  if (!session || !shouldRenewSession(session, { ttlSeconds: config.sessionTtlSeconds })) return;
  response.setHeader("set-cookie", sessionCookie(createSessionToken({
    userId: session.sub,
    channelId: config.channelId,
    signingSecret: config.signingSecret,
    ttlSeconds: config.sessionTtlSeconds
  })));
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function pruneUsedLaunchTokens() {
  pruneUsedTokens(usedLaunchTokens);
}

function pruneUsedTokens(tokens) {
  const now = Math.floor(Date.now() / 1000);
  for (const [id, expiresAt] of tokens) {
    if (expiresAt <= now) tokens.delete(id);
  }
}

server.listen(config.port, config.host, () => {
  console.log(`Donut Town is running on ${config.host}:${config.port}`);
  console.log(config.botToken && config.channelId ? "Slack member sync is configured." : "Slack is in local demo mode; add .env.local to connect.");
  console.log(isSlackLoginConfigured() ? "One-click Slack entry is configured." : "One-click Slack entry needs SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.");
  if (profileStore.configured) console.log("Legacy Sheet profile settings detected; Slack profiles are used for town member cards.");
  console.log(config.stagingPassword ? "Staging password protection is enabled." : "Staging password protection is disabled for local development.");
  console.log(config.allowSend ? "Slack DM sending is ENABLED." : "Slack DM sending is disabled (dry-run mode)." );
});
