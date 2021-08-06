import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Connection, PublicKey } from '@solana/web3.js';
import { pool } from './database';

const solanaNetworkAddress = 'https://api.mainnet-beta.solana.com';
const jAddy1 = 'Hr31mmEsjg6eqZFGHZWtCcv7msrz9ZqTkHF5Gp2BmdGV';
const checkMintsIntervalTime = 2000;
const signaturesIntervalTime = 5000;

async function getLatestSignatures() {
  pool.connect().then(async (client) => {
    let connection = new Connection(solanaNetworkAddress);
    let watchedAddress = new PublicKey(jAddy1);
      connection.getSignaturesForAddress(watchedAddress).then( (info) => {
        info.forEach(async sig => {
          try {
            const insertSigQuery = {
              name: 'insert-signature',
              text: `
                  INSERT INTO public.signatures
                  (signature, checked)
                  VALUES($1, $2) ON CONFLICT (signature) DO NOTHING;
                `,
              values: [sig.signature, false]
            }
            await pool.query(insertSigQuery).catch((e: any) => {
              console.log("Error during signature transaction query: " + e);
            });
          } catch (e) {
            console.log("Error writing signature to DB: " + e);
          }
        })
      }).catch((e: any) => {
        console.log("Error getting sig info: " + e);
      });
      client.release();
  }).catch((e: any) => {
    console.log("Error connecting: " + e);
  });
}

async function checkForMints() {
  pool.connect().then(async (client) => {
    let connection = new Connection(solanaNetworkAddress);
    try {
      var signatures;
      const getSigQuery = {
        name: 'get-signatures',
        text: `
            SELECT signature FROM public.signatures
            WHERE checked = false limit 5
          `
      }
      signatures = await pool.query(getSigQuery).catch((e: any) => {
        console.log("Error getting latest signatures query: " + e);
      });
      const sigDelay = 200;
      signatures.rows.forEach(async (sig, index) => {
        setTimeout(async() =>{
          connection.getTransaction(sig.signature).then(async resp => {
            try {
              const updateSignatureQuery = {
                name: 'update-sig-checked',
                text: `
                    UPDATE public.signatures 
                    set checked = true 
                    where signature = $1
                  `,
                values: [sig.signature]
              }
              await pool.query(updateSignatureQuery).catch((e: any) => {
                console.log("Error updating signature checked for " + sig.signature + ": " + e);
              });
            } catch (e) {
              console.log("Error updating signature checked in DB: " + e);
            }
            if (resp.transaction.message.accountKeys.length == 3) {
              resp.transaction.message.accountKeys.forEach(async account => {
                  if (account.toString() != "11111111111111111111111111111111" &&
                      account.toString() != jAddy1) {
                    try {
                      const insertMintQuery = {
                        name: 'insert-mint',
                        text: `
                            INSERT INTO public.mint_txns
                            (from_address, signature, minted, seen)
                            VALUES($1, $2, $3, $4) ON CONFLICT (from_address, signature) DO NOTHING;
                          `,
                        values: [account.toString(), sig.signature, false, new Date().toISOString()]
                      }
                      await pool.query(insertMintQuery).catch((e: any) => {
                        console.log("Error during mint transaction query: " + e);
                      });
                    } catch (e) {
                      console.log("Error writing mint transaction to DB: " + e);
                    }
                  }
              })
            }
          }).catch((e: any) => {
            console.log("Error getting txn for signature " + sig.signature + ": " + e);
          });

        }, sigDelay * index);
      });
    } catch (e) {
      console.log("Error getting latest signatures from DB: " + e);
    }
    client.release();
  }).catch((e: any) => {
    console.log("Error connecting: " + e);
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setInterval(getLatestSignatures, signaturesIntervalTime);
  setInterval(checkForMints, checkMintsIntervalTime);
  await app.listen(3000);
}
bootstrap();
