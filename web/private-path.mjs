// The repository is not a public file directory. In particular, local HTTPS
// development must never serve ignored credentials or Git/agent working files.
export function isPrivatePath(relativePath) {
  return relativePath.split(/[\\/]/).some(part => part.startsWith('.') || part === 'art-source' || part === 'node_modules');
}
