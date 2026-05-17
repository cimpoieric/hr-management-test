const u = process.env.DATABASE_URL || "";
const d = process.env.DIRECT_DATABASE_URL || "";
function host(url) {
  const m = url.match(/@([^/]+)/);
  return m ? m[1] : "(unset)";
}
console.log("DATABASE_URL host:", host(u));
console.log("DIRECT_DATABASE_URL host:", host(d));
