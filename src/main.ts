import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { pool } from './database';
import * as fs from "fs";
import { strict } from 'assert/strict';
import { mintList } from './mintList';
import { mintAndMetaList } from './mintAndMetaList';
import axios, { AxiosResponse } from 'axios';

const solanaNetworkAddress = 'https://solana-api.projectserum.com';
// const solanaNetworkAddress = 'https://api.mainnet-beta.solana.com';
const jAddy1 = '55fXB8EJLWeYgdAbpSGyoWKLpZXpjrLGf8VYofwNp2KB';
const dogeDevAddress = 'HwMBMB6QpPJNyFnbVtt2UKVmJQPGnKKsMfaxNUyWahmc';
const expectedLamports = 1250000000;
const checkMintsIntervalTime = 2000;
const signaturesIntervalTime = 5000;
const checkValidSales = 2000;
const saleSignaturesIntervalTime = 5000;

async function uploadMintAndImageUris() {
  pool.connect().then(async (client) => {
    mintAndMetaList.forEach(async mintAndMetaUri => {
      // console.log("mintAndMetaUri: " + JSON.stringify(mintAndMetaUri));
      // var mintAndMetaUri = mintAndMetaList[0];
      // console.log("meta uri: " + mintAndMetaUri["uri"]);

      let result: AxiosResponse = await axios.get(mintAndMetaUri["uri"]);
      // console.log("result: " + JSON.stringify(result.data));
      console.log("image uri: " + result.data.image);
      try {
        const insertMintAndImageUriQuery = {
          name: 'insert-mint-and-image-uri',
          text: `
              INSERT INTO public.mint_image_uris
              (mint, image_uri)
              VALUES($1, $2) ON CONFLICT (mint) DO NOTHING;
            `,
          values: [mintAndMetaUri["mint"], result.data.image]
        }
        await pool.query(insertMintAndImageUriQuery).catch((e: any) => {
          console.log("Error during mint and image uri query: " + e);
        });
      } catch (e) {
        console.log("Error writing signature to DB: " + e);
      }
    });
    client.release();
  }).catch((e: any) => {
    console.log("Error connecting: " + e);
  });
}

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

              if (resp.meta.postBalances.length >= 2) {
                if (Math.abs(resp.meta.postBalances[1] - resp.meta.preBalances[1]) == expectedLamports) {
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
              }
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


async function getLatestSaleSignatures() {
  pool.connect().then(async (client) => {
    let connection = new Connection(solanaNetworkAddress);
    let watchedAddress = new PublicKey(dogeDevAddress);
      connection.getSignaturesForAddress(watchedAddress).then( (info) => {
        info.forEach(async sig => {
          try {
            const insertSigQuery = {
              name: 'insert-sales-signature',
              text: `
                  INSERT INTO public.sales_signatures
                  (sales_signature, checked)
                  VALUES($1, $2) ON CONFLICT (sales_signature) DO NOTHING;
                `,
              values: [sig.signature, false]
            }
            await pool.query(insertSigQuery).catch((e: any) => {
              console.log("Error during sales signature transaction query: " + e);
            });
          } catch (e) {
            console.log("Error writing sales signature to DB: " + e);
          }
        })
      }).catch((e: any) => {
        console.log("Error getting sales sig info: " + e);
      });
      client.release();
  }).catch((e: any) => {
    console.log("Error connecting: " + e);
  });
}

function looksLikeASale(resp) {
  var hasDevAddress = false;
  var hasPaymentOverOneSol = false;
  var hasNFTTransfer = false;

  if (resp.transaction && resp.transaction.message && resp.transaction.message.accountKeys) {
    resp.transaction.message.accountKeys.forEach(key => {
      if (key.toString() == dogeDevAddress) {
        hasDevAddress = true;
      }
    });
  }

  if (resp.meta && resp.meta.preBalances && resp.meta.postBalances) {
    var singleSolLamports = 1000000000;
    for (let i = 0; i < resp.meta.preBalances.length; i++) {
      //console.log("balances: " + JSON.stringify(resp.meta.preBalances[i] + ", " + JSON.stringify(resp.meta.postBalances[i])));
      if (resp.meta.preBalances[i] - resp.meta.postBalances[i] > singleSolLamports) {
        hasPaymentOverOneSol = true;
      }
    }
  }

  if (resp.meta && resp.meta.preTokenBalances && resp.meta.postTokenBalances) {
    for (let i = 0; i < resp.meta.preTokenBalances.length; i++) {
      const currMint = resp.meta.preTokenBalances[i].mint;
      if (mintList.includes(currMint)) {
        // console.log("Found mint (" + JSON.stringify(currMint) + ") inside the mintList!");
        if (resp.meta.preTokenBalances[i].uiTokenAmount.amount > 0){
          // console.log("Detected NFT transfer!");
          hasNFTTransfer = true;
        }
      }
    }
  }

  // console.log("hasDevAddress        : " + JSON.stringify(hasDevAddress));
  // console.log("hasPayementOverOneSol: " + JSON.stringify(hasPaymentOverOneSol));
  // console.log("hasNFTTransfer       : " + JSON.stringify(hasNFTTransfer));

  return hasDevAddress && hasPaymentOverOneSol && hasNFTTransfer;
}

function writeSaleToDatabase(signature, resp) {
  var saleAmount = -1;
  if (resp.meta && resp.meta.preBalances && resp.meta.postBalances) {
    var singleSolLamports = 1000000000;
    for (let i = 0; i < resp.meta.preBalances.length; i++) {
      if (resp.meta.preBalances[i] - resp.meta.postBalances[i] > singleSolLamports) {
        var currAmount = resp.meta.preBalances[i] - resp.meta.postBalances[i];
        if (currAmount > saleAmount) {
          saleAmount = currAmount;
        }
      }
    }
  }
  var mint = "unknown";
  if (resp.meta && resp.meta.preTokenBalances && resp.meta.postTokenBalances) {
    for (let i = 0; i < resp.meta.preTokenBalances.length; i++) {
      const currMint = resp.meta.preTokenBalances[i].mint;
      if (mintList.includes(currMint)) {
        // console.log("Found mint (" + JSON.stringify(currMint) + ") inside the mintList!");
        if (resp.meta.preTokenBalances[i].uiTokenAmount.amount > 0){
          // console.log("Detected NFT transfer!");
          mint = currMint;
        }
      }
    }
  }
  pool.connect().then(async (client) => {
    var uri = "unknown";
    if (mint != "unknown") {
     try {
       var signatures;
       const getUriQuery = {
         name: 'get-mint-uri',
         text: `
             SELECT mint, image_uri FROM public.mint_image_uris
             WHERE mint = $1
           `,
         values: [mint]
       }
       signatures = await pool.query(getUriQuery).then(res => {
         uri = res.rows[0]["image_uri"];
       }).catch((e: any) => {
         console.log("Error getting mint image uri query: " + e);
       });
     } catch (e) {
       console.log("Error getting mint URI from DB: " + e);
     }

    }
    try {
      const insertSigQuery = {
        name: 'insert-sales-txn',
        text: `
            INSERT INTO public.sales_txns
            (sales_signature, checked, amount, mint, image_uri)
            VALUES($1, $2, $3, $4, $5) ON CONFLICT (sales_signature) DO NOTHING;
          `,
        values: [signature, false, saleAmount, mint, uri]
      }
      await pool.query(insertSigQuery).catch((e: any) => {
        console.log("Error during sales signature transaction query: " + e);
      });
    } catch (e) {
      console.log("Error writing sales signature to DB: " + e);
    }
    client.release();
  }).catch((e: any) => {
    console.log("Error connecting: " + e);
  });

  return true;
}

async function checkForValidSales() {
  // console.log("Checking for valid sales...");
  pool.connect().then(async (client) => {
    let connection = new Connection(solanaNetworkAddress);
    try {
      var sales_signatures;
      const getSigQuery = {
        name: 'get-sales-signatures',
        text: `
            SELECT sales_signature FROM public.sales_signatures
            WHERE checked = false limit 5
          `
      }
      sales_signatures = await pool.query(getSigQuery).catch((e: any) => {
        console.log("Error getting latest sales signatures query: " + e);
      });
      const sigDelay = 200;
      sales_signatures.rows.forEach(async (sig, index) => {
        setTimeout(async() =>{
          connection.getTransaction(sig.sales_signature).then(async resp => {
            try {
              const updateSignatureQuery = {
                name: 'update-sales-sig-checked',
                text: `
                    UPDATE public.sales_signatures 
                    set checked = true 
                    where sales_signature = $1
                  `,
                values: [sig.sales_signature]
              }
              await pool.query(updateSignatureQuery).catch((e: any) => {
                console.log("Error updating sales signature checked for " + sig.sales_signature + ": " + e);
              });
            } catch (e) {
              console.log("Error updating sales signature checked in DB: " + e);
            }
            if (looksLikeASale(resp)) {
              console.log("Looks like a sale! : " + JSON.stringify(sig.sales_signature));
              var res = writeSaleToDatabase(sig.sales_signature, resp);
              if (!res) {
                console.log("Error tracking sale!: " + JSON.stringify(sig.sales_signature));
              }
            } else {
              console.log("Not a sale. : " + JSON.stringify(sig.sales_signature));
            }
          }).catch((e: any) => {
            console.log("Error getting txn for sales signature " + sig.signature + ": " + e);
          });

        }, sigDelay * index);
      });
    } catch (e) {
      console.log("Error getting latest sales signatures from DB: " + e);
    }
    client.release();
  }).catch((e: any) => {
    console.log("Error connecting: " + e);
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // setInterval(getLatestSignatures, signaturesIntervalTime);
  // setInterval(checkForMints, checkMintsIntervalTime);
  // uploadMintAndImageUris();
  setInterval(getLatestSaleSignatures, saleSignaturesIntervalTime);
  setInterval(checkForValidSales, checkValidSales);
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
