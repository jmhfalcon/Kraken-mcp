
import express from "express";
import ccxt from "ccxt";
import { randomUUID } from "node:crypto";
import {z} from "zod"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
app.use(express.json());

const port = Number(process.env.PORT) || 8080;

const kraken = new ccxt.kraken({
  apiKey: process.env.KRAKEN_API_KEY,
  secret: process.env.KRAKEN_API_SECRET,
  enableRateLimit: true,
});

const sessions = new Map();

function createMcpServer() {
  const server = new McpServer(
    {
      name: "kraken-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.tool(
    "get_balance",
    "Get Kraken account balances. Requires valid Kraken API credentials.",
    {},
    async () => {
      const balance = await kraken.fetchBalance();
      return {
        content: [{ type: "text", text: JSON.stringify(balance.total) }],
      };
    },
  );

  server.tool(
    "get_positions",
    "Get open Kraken orders.",
    {},
    async () => {
      const orders = await kraken.fetchOpenOrders();
      return {
        content: [{ type: "text", text: JSON.stringify(
          orders) }],
      };
    },
  );

  server.tool(
    "get_ticker",
    "Get ticker price for a symbol such as BTC/USD or ETH/USD.",
    {
      symbol: {
        type: "string",
        description: "Kraken market symbol, for example BTC/USD",
      },
    },
    async ({ symbol }) => {
      const ticker = await kraken.fetchTicker(symbol);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              symbol,
              last: ticker.last,
              bid: ticker.bid,
              ask: ticker.ask,
            }),
          },
        ],
      };
    },
  );

  server.tool(
    "place_limit_order",
    "Place a post-only limit order on Kraken. This can trade real funds.",
    {
      symbol: { type: "string", description: "Market symbol, for example BTC/USD" },
      side: { type: "string", enum: ["buy", "sell"] },
      amount: { type: "number", description: "Order amount" },
      price: { type: "number", description: "Limit price" },
    },
    async ({ symbol, side, amount, price }) => {
      const order = await kraken.createOrder(
        symbol,
        "limit",
        side,
        amount,
        price,
        { postOnly: true },
      );
      return {
        content: [{ type: "text", text: JSON.stringify
                   (order) }],
      };
    },
  );

  server.tool(
    "place_market_order",
    "Place a market order on Kraken. This can trade real funds.",
    {
      symbol: { type: "string", description: "Market symbol, for example BTC/USD" },
      side: { type: "string", enum: ["buy", "sell"] },
      amount: { type: "number", description: "Order amount" },
    },
    async ({ symbol, side, amount }) => {
      const order = await kraken.createOrder(symbol, "market", side, amount);
      return {
        content: [{ type: "text", text: JSON.stringify(order) }],
      };
    },
  );

  server.tool(
    "cancel_order",
    "Cancel an open Kraken order by its order ID.",
    {
      order_id: { type: "string", description: "Kraken order ID" },
    },
    async ({ order_id }) => {
      const result = await kraken.cancelOrder(order_id);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    },
  );

  return server;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const server = createMcpServer();

  sessions.set(transport.sessionId, { transport, server });

  transport.onclose = async () => {
    sessions.delete(transport.sessionId);
    try {
      await server.close();
    } catch (error) {
      console.error("Error closing MCP server:", error);
    }
  };

  transport.onerror = (error) => {
    console.error("MCP SSE transport error:", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(transport.sessionId);
    console.error("Could not start MCP SSE session:", error);
    if (!res.headersSent) {
      res.status(500).end("Could not start MCP SSE session");
    }
  }
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  if (typeof sessionId !== "string") {
    return res.status(400).send("Missing sessionId");
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).send("Unknown or closed MCP session");
  }

  try {
    await session.transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error("MCP message handling error:", error);
    if (!res.headersSent) {
      res.status(500).send("Could not handle MCP message");
    }
  }
});
console.log("Kraken MCP server listening on port " + port);
app.listen(port, "0.0.0.0", () => {
  console.log("SSE endpoint: /sse");
  console.log("Messages endpoint: /messages");
});
