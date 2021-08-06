import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Connection, PublicKey } from '@solana/web3.js';
import { Market } from '@project-serum/serum';
import { pool } from './database';

const solanaNetworkAddress = 'https://api.mainnet-beta.solana.com';
const serumMarketAddress = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
const intervalTime = 20000;

async function getFills() {

  pool.connect().then(async (client) => {
    const marketQuery = {
      name: 'fetch-markets',
      text: 'SELECT * FROM public.markets'
    }

    var marketsList;
    try {
      marketsList = await pool.query(marketQuery);
    } catch (e) {
      console.log("Error getting markets from DB: " + e);
    }

    if (marketsList && marketsList.rows) {
      const pollDelay = intervalTime / 2 / marketsList.rows.length;
      // console.log("pollDelay: " + pollDelay);
      let connection = new Connection(solanaNetworkAddress);
      marketsList.rows.forEach(async (element, index) => {
        setTimeout(async () => {
          let marketAddress = new PublicKey(element.market_id);
          let programId = new PublicKey(serumMarketAddress);
          let market = await Market.load(connection, marketAddress, {}, programId)

          let fills = [];
          try {
            // console.log("Getting fills for: " + element.market_name);
            fills = await market.loadFills(connection, 20);
          } catch (e) {
            console.log("Error getting fills: " + e);
          }


          // TODO: temporarily not inserting
          // fills.forEach(async (fill) => {
          //   try {
          //     const insertTradeQuery = {
          //       name: 'insert-trade',
          //       text: `
          //             INSERT INTO public.executions
          //             (id, market_id, price, exectime, side, "size", order_id, volume)
          //             VALUES(DEFAULT, $1, $2, $3, $4, $5, $6, $7) ON CONFLICT (market_id, price, side, "size", order_id) DO NOTHING;
          //           `,
          //       values: [element.market_id, fill.price, new Date().toISOString(), fill.side, fill.size, fill.orderId, fill.size * fill.price]
          //     }
          //     await pool.query(insertTradeQuery);
          //   } catch (e) {
          //     console.log("Error writing fill to DB: " + e);
          //   }
          // })
        }, pollDelay * index);
      });
      client.release();
    }
  }).catch((e: any) => {
    console.log("Error connecting: " + e);
  });
}

async function getEventQueue() {
    console.log("Getting event queue..");

    console.log("Done.");
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  getEventQueue();
  setInterval(getEventQueue, intervalTime);
  await app.listen(3000);
}
bootstrap();
