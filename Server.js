import express from 'express';
import ccxt from 'ccxt';

const app = express();
app.use(express.json());

const port = process.env.PORT || 8080;

const kraken = new ccxt.kraken({
  apiKey: process.env.KRAKEN_API_KEY,
  secret: process.env.KRAKEN_API_SECRET,
  enableRateLimit: true,
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;

  try {
    if (method === 'tools/list') {
      return res.json({
        tools: [
          {
            name: 'get_balance',
            description: 'Get Kraken account balances',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'get_positions',
            description: 'Get open orders and positions',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'get_ticker',
            description: 'Get ticker price for a symbol like BTC/USD or ETH/USD',
            inputSchema: {
              type: 'object',
              properties: { symbol: { type: 'string' } },
              required: ['symbol']
            }
          },
          {
            name: 'place_limit_order',
            description: 'Place a limit post-only order on Kraken',
            inputSchema: {
              type: 'object',
              properties: {
                symbol: { type: 'string' },
                side: { type: 'string', enum: ['buy', 'sell'] },
                amount: { type: 'number' },
                price: { type: 'number' }
              },
              required: ['symbol', 'side', 'amount', 'price']
            }
          },
          {
            name: 'place_market_order',
            description: 'Place a market order on Kraken',
            inputSchema: {
              type: 'object',
              properties: {
                symbol: { type: 'string' },
                side: { type: 'string', enum: ['buy', 'sell'] },
                amount: { type: 'number' }
              },
              required: ['symbol', 'side', 'amount']
            }
          },
          {
            name: 'cancel_order',
            description: 'Cancel an open order by ID',
            inputSchema: {
              type: 'object',
              properties: { order_id: { type: 'string' } },
              required: ['order_id']
            }
          }
        ]
      });
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params;

      if (name === 'get_balance') {
        const balance = await kraken.fetchBala
        nce();
        return res.json({ content: [{ type: 'text', text: JSON.stringify(balance.total) }] });
      }

      if (name === 'get_positions') {
        const orders = await kraken.fetchOpenOrders();
        return res.json({ content: [{ type: 'text', text: JSON.stringify(orders) }] });
      }

      if (name === 'get_ticker') {
        const ticker = await kraken.fetchTicker(args.symbol);
        return res.json({ content: [{ type: 'text', text: JSON.stringify({ last: ticker.last, bid: ticker.bid, ask: ticker.ask }) }] });
      }

      if (name === 'place_limit_order') {
        const order = await kraken.createOrder(args.symbol, 'limit', args.side, args.amount, args.price, { postOnly: true });
        return res.json({ content: [{ type: 'text', text: JSON.stringify(order) }] });
      }

      if (name === 'place_market_order') {
        const order = await kraken.createOrder(args.symbol, 'market', args.side, args.amount);
        return res.json({ content: [{ type: 'text', text: JSON.stringify(order) }] });
      }

      if (name === 'cancel_order') {
        const result = await kraken.cancelOrder(args.order_id);
        return res.json({ content: [{ type: 'text', text: JSON.stringify(result) }] });
      }

      return res.status(400).json({ error: 'Unknown tool: ' 
        + name });
    }

    res.status(400).json({ error: 'Unsupported method' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log('Kraken MCP server running on port ' + port);
});
                                   
