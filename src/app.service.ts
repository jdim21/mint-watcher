import { Injectable } from '@nestjs/common';
import { stringify } from 'querystring';
import { pool } from './database';

@Injectable()
export class AppService {
  async getHello(): Promise<string> {
    return await pool.connect().then(async (client) => {
      try {
        const selectQuery = {
          name: 'select-remaining',
          text: `
            select count(*) from public.mint_txns where attempted = true
            `,
        }
        var res = await pool.query(selectQuery).catch((e: any) => {
          console.log("Error selecting mints query: " + e);
          client.release();
          return 'xxxxx';
        });
        const remaining = 17576 - parseInt(res.rows[0]["count"]);
        client.release();
        if (remaining <= 0) {
          return "SoldOut";
        }
        return remaining;
      } catch (e) {
        console.log("Exception selecting mints from DB: " + e);
        client.release();
        return 'xxxxx';
      }
    }).catch((e: any) => {
      console.log("Error connecting to DB: " + e);
      return 'xxxxx';
    });
  }
}
