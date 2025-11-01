const ALCHEMY_BSC_URL = "https://bnb-mainnet.g.alchemy.com/v2/Dan4RPJdNQohMhYk5c4IKhT2BimHScb4";
const ADDRESS = "0xaB409dd248aDFd06D841817158F472C95A490F97".toLowerCase();

async function rpcRequest(method, params = []) {
    const res = await fetch(ALCHEMY_BSC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params
        })
    });

    const json = await res.json();

    if (json.error) {
        throw new Error(`RPC ${method} failed: ${json.error.message ?? JSON.stringify(json.error)}`);
    }

    return json.result;
}

const MAX_BLOCK_WINDOW = 10; // Free Alchemy BNB tier allows 10-block range per request
const CATEGORIES = ["external", "erc20", "erc721", "erc1155"]; // BNB chain does not support "internal"

async function fetchTransfers(address, { fromBlock, toBlock, direction, maxCount }) {
    const filter = {
        fromBlock,
        toBlock,
        category: CATEGORIES,
        withMetadata: true,
        order: "desc",
        maxCount
    };

    if (direction === "in") {
        filter.toAddress = address;
    } else if (direction === "out") {
        filter.fromAddress = address;
    }

    const resp = await rpcRequest("alchemy_getAssetTransfers", [filter]);
    return resp.transfers ?? [];
}

async function getRecentTransactions({ address, lookbackBlocks = 100, maxCount = 20 } = {}) {
    if (!address) {
        throw new Error("Address is required");
    }

    const latestBlockHex = await rpcRequest("eth_blockNumber");
    const latestBlock = parseInt(latestBlockHex, 16);

    if (Number.isNaN(latestBlock)) {
        throw new Error(`Unexpected latest block response: ${latestBlockHex}`);
    }

    const earliestBlock = Math.max(latestBlock - lookbackBlocks, 0);
    const results = [];

    const hex = (num) => "0x" + num.toString(16);
    let chunkEnd = latestBlock;

    while (chunkEnd >= earliestBlock && results.length < maxCount) {
        const chunkStart = Math.max(chunkEnd - (MAX_BLOCK_WINDOW - 1), earliestBlock);
        const [incoming, outgoing] = await Promise.all([
            fetchTransfers(address, {
                fromBlock: hex(chunkStart),
                toBlock: hex(chunkEnd),
                direction: "in",
                maxCount: "0x" + maxCount.toString(16)
            }),
            fetchTransfers(address, {
                fromBlock: hex(chunkStart),
                toBlock: hex(chunkEnd),
                direction: "out",
                maxCount: "0x" + maxCount.toString(16)
            })
        ]);

        results.push(...incoming, ...outgoing);

        chunkEnd = chunkStart - 1;
    }

    const combined = results
        .sort((a, b) => {
            const aTime = a.metadata?.blockTimestamp ?? "";
            const bTime = b.metadata?.blockTimestamp ?? "";
            return aTime < bTime ? 1 : aTime > bTime ? -1 : 0;
        })
        .slice(0, maxCount);

    console.log(combined);
}

getRecentTransactions({ address: ADDRESS }).catch(err => {
    console.error(err.message);
});
