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
          return 'xxxx';
        });
        const remaining = 5000 - parseInt(res.rows[0]["count"]);
        client.release();
        if (remaining <= 25) {
          return "SoldOut";
        }
        return remaining;
      } catch (e) {
        console.log("Exception selecting mints from DB: " + e);
        client.release();
        return 'xxxx';
      }
    }).catch((e: any) => {
      console.log("Error connecting to DB: " + e);
      return 'xxxx';
    });
  }

  async getTokenList(): Promise<string> {
    return await pool.connect().then(async (client) => {
      try {
        const selectQuery = {
          name: 'select-token-list',
          text: `
            select created_at from public.mints where assigned = true 
              and created_at != '5kwL71qcySTxyibNqs4G9hT8fNS9aeUjyDduF6Cp1HhP' 
              and created_at != '3RqPVtvZgZP9KF3LdJxM7M7fDYrDfN7wNCZCN4phfHFm'
              and created_at != '5b3vocJytudP3Fa3EpbtuUBsy99WkjaJAFmc5ePxfrBM'
              and created_at != '3SXbVeGqwq3D2qVbMdNxpy4dgdwMT8e9agepG9wcCrja'
              and created_at != '2zXM88roiCEKvhCYhPKkKiMjtynDA2cKqpUnVNSHMyai'
              and created_at != '2FCx5mxKguEiydgfGFN5qYD3pFYygokGXpnssG6qn7GK'
              and created_at != 'KxpAwhyhkggg6feu1fBdk7kRgkfsz5Yx2jJgcdKp5sG'
              and created_at != 'BmR82S81JR5PVZ8WZme2bTkhZ34eXhQc31fs6TYQXLfC'
              and created_at != 'HVC8uSziU5CqzMHZeAGohfxVW2FqTX3w9vhyvvUL5u5a'
              and created_at != '9N7EEdPXed5zAeoQVZCJBPfXMEreCaQEifjcmgje5g8S'
              and created_at != 'Cgsr3xwFmTpexpiTz2qKqVu4UB7ENCPAF8wPW8CqadAY'
              and created_at != '4P9GNPgzEvXNA4kCfitNhHw3BWhHBjQg4NNbGvQGnrkM'
              and created_at != 'K9ToveLE1qQa582dpUSfGaLf9KmNKbEeadEk1DwafVN'
              and created_at != 'GWa1CjUAfqBFXfw8AwEW1wS2SCMd2NMqZ3oTTGN9oMw7'
              and created_at != 'GEoDzGp2mLYBbxNcTWCQqb9bEASypG1bHdypqAfeY8on'
              and created_at != '9pKPbCLtZeYh5La8QSk8cKHGmmBuXw3j5Vaq4JHasas8'
              and created_at != '96KufJ6VjVA7qWyC7aorjt83QUEgY8tFdbikNdGtH5nH'
            `,
        }
        var res = await pool.query(selectQuery).catch((e: any) => {
          console.log("Error selecting mints query: " + e);
          client.release();
          return 'xxxx';
        });
        var tokenList = {"tokenList": []};
        res.rows.forEach(async (address) => {
          console.log("address: " + address["created_at"]);
          if (address["created_at"] != null && address["created_at"] != undefined && address["created_at"] != "") {
            tokenList.tokenList.push(address["created_at"]);
          }
        });
        client.release();
        return tokenList;
      } catch (e) {
        console.log("Exception selecting mints from DB: " + e);
        client.release();
        return 'xxxx';
      }
    }).catch((e: any) => {
      console.log("Error connecting to DB: " + e);
      return 'xxxx';
    });
  }
}
