// Fake Razorpay + RazorpayX API for offline checks.  node fake_razorpay.mjs  (port 4010)
import http from "node:http";
const S = { n: 0, orders: {}, byKey: {}, payoutRequests: 0, payoutsCreated: 0, keys: [], fail503: 0, fail400: 0 };
const RUN = Date.now().toString(36);
const id = (p) => `${p}_${RUN}${++S.n}`;
const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const b = body ? JSON.parse(body) : {};
    const u = req.url.split("?")[0];
    if (req.method === "POST" && u === "/__ctl") {
      if (b.paid) S.orders[b.paid] = { ...(S.orders[b.paid] || { id: b.paid, amount: 0 }), status: "paid" };
      if (b.order) S.orders[b.order] = { id: b.order, amount: 0, status: "created" };
      if (b.fail503Once) S.fail503 = 1;
      if (b.fail400Once) S.fail400 = 1;
      if (b.resetStats) Object.assign(S, { payoutRequests: 0, payoutsCreated: 0, keys: [] });
      return send(res, 200, { ok: true });
    }
    if (req.method === "GET" && u === "/__stats")
      return send(res, 200, { payoutRequests: S.payoutRequests, payoutsCreated: S.payoutsCreated, distinctKeys: new Set(S.keys).size, missingKey: S.keys.filter((k) => !k).length });
    if (req.method === "POST" && u === "/v1/orders") {
      const o = { id: id("order"), amount: b.amount, status: "created", receipt: b.receipt };
      S.orders[o.id] = o; return send(res, 200, o);
    }
    const m = u.match(/^\/v1\/orders\/([^/]+)$/);
    if (req.method === "GET" && m) return S.orders[m[1]] ? send(res, 200, S.orders[m[1]]) : send(res, 404, { error: { description: "not found" } });
    if (req.method === "POST" && u === "/v1/contacts") return send(res, 200, { id: id("cont") });
    if (req.method === "POST" && u === "/v1/fund_accounts") return send(res, 200, { id: id("fa") });
    if (req.method === "POST" && u === "/v1/payouts") {
      S.payoutRequests++;
      const key = req.headers["x-payout-idempotency"] || "";
      S.keys.push(key);
      if (S.fail400) { S.fail400 = 0; return send(res, 400, { error: { description: "beneficiary bank down" } }); }
      let p = key && S.byKey[key];
      if (!p) { p = { id: id("pout"), status: "processing", amount: b.amount, reference_id: b.reference_id }; S.payoutsCreated++; if (key) S.byKey[key] = p; }
      if (S.fail503) { S.fail503 = 0; return send(res, 503, { error: { description: "gateway timeout" } }); }
      return send(res, 200, p);
    }
    send(res, 404, { error: { description: `no route ${req.method} ${u}` } });
  });
}).listen(4010, "127.0.0.1", () => console.log("fake razorpay on 127.0.0.1:4010"));
