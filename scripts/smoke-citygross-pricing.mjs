const baseUrl = process.env.PRICING_BASE_URL ?? "http://127.0.0.1:3000";
const expectEmpty = process.env.EXPECT_EMPTY === "1";
const items = [
  { id: "egg-1", name: "ägg" },
  { id: "egg-2", name: "ägg" },
  { id: "milk", name: "mjölk" },
  { id: "pasta", name: "pasta" },
  { id: "coffee", name: "kaffe" },
  { id: "banana", name: "banan" },
];

const requestBasket = async () => {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/pricing/basket`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chain: "city_gross", items }),
  });
  const body = await response.json();
  return {
    status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
    body,
  };
};

const printRun = (label, run) => {
  const matches = Array.isArray(run.body?.matches) ? run.body.matches : [];
  const matched = matches.filter((match) => match.product);
  console.log(`\n${label}: HTTP ${run.status} (${run.durationMs} ms)`);
  console.log(`Matched items: ${matched.length}/${matches.length}`);
  for (const match of matches) {
    console.log(
      `${match.listItemName} → ${match.product?.productName ?? "no match"} → ${
        match.product ? `${match.product.priceSek} kr` : "—"
      } → ${match.confidence}`,
    );
  }
  console.log(`approximateTotalSek: ${run.body?.approximateTotalSek ?? 0} kr`);
};

const first = await requestBasket();
const second = await requestBasket();
printRun("First basket request", first);
printRun("Second basket request (cache check)", second);

if (first.status !== 200 || second.status !== 200) {
  throw new Error("Basket pricing endpoint did not return HTTP 200.");
}

const firstMatched = first.body.matches.filter((match) => match.product).length;
if (expectEmpty) {
  if (firstMatched !== 0 || first.body.approximateTotalSek !== 0) {
    throw new Error("Expected feature-disabled pricing to return only no-match results.");
  }
} else if (firstMatched === 0 || first.body.approximateTotalSek <= 0) {
  throw new Error("Live City Gross smoke returned no priced products.");
}
