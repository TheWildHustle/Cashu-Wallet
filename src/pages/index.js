import useProofStorage from "@/hooks/useProofStorage";
import { CashuMint, CashuWallet, getEncodedToken } from "@cashu/cashu-ts";
import React, { useState, useEffect } from "react";

const Wallet = () => {
  const [formData, setFormData] = useState({
    mintUrl: "",
    mintAmount: "",
    meltInvoice: "",
    swapAmount: "",
    swapToken: "",
  });
  const [dataOutput, setDataOutput] = useState(null);
  /**
   * @type {[CashuWallet|null, React.Dispatch<React.SetStateAction<CashuWallet|null>>]}
   */
  const [wallet, setWallet] = useState(null);

  const { addProofs, balance, removeProofs, getProofsByAmount } =
    useProofStorage();

  useEffect(() => {
    const storedMintData = JSON.parse(localStorage.getItem("mint"));
    if (storedMintData) {
      const { url, keyset } = storedMintData;
      const mint = new CashuMint(url);

      // initialize wallet with store keyset so we don't have to fetch them again
      const wallet = new CashuWallet(mint, { keys: keyset, unit: "sat" });
      setWallet(wallet);

      setFormData((prevData) => ({ ...prevData, mintUrl: url }));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSetMint = async () => {
    const mint = new CashuMint(formData.mintUrl);
 
    try {
      const info = await mint.getInfo();
      setDataOutput(info);
 
      const { keysets } = await mint.getKeys();
 
      const satKeyset = keysets.find((k) => k.unit === "sat");
      setWallet(new CashuWallet(mint, {keys: satKeyset}));

      localStorage.setItem(
        "mint",
        JSON.stringify({ url: formData.mintUrl, keyset: satKeyset })
      );
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to connect to mint", details: error });
    }
  };
 

  const handleMint = async () => {
    const amount = parseInt(formData.mintAmount);
    const quote = await wallet.getMintQuote(amount);
    setDataOutput(quote);
 
    const intervalId = setInterval(async () => {
      try {
        const { proofs } = await wallet.mintTokens(amount, quote.quote, {
          keysetId: wallet.keys.id,
        });
        setDataOutput({ "minted proofs": proofs });
        setFormData((prevData) => ({ ...prevData, mintAmount: "" }));
        addProofs(proofs);
        clearInterval(intervalId);
      } catch (error) {
        console.error("Quote probably not paid: ", quote.request, error);
        setDataOutput({ error: "Failed to mint", details: error });
      }
    }, 5000);
  };
 

  const handleMelt = async () => {
    try {
      const quote = await wallet.getMeltQuote(formData.meltInvoice);
      setDataOutput([{ "got melt quote": quote }]);
      const amount = quote.amount + quote.fee_reserve;
      const proofs = getProofsByAmount(amount, wallet.keys.id);
      if (proofs.length === 0) {
        alert("Insufficient balance");
        return;
      }
      const { isPaid, change } = await wallet.meltTokens(quote, proofs, {
        keysetId: wallet.keys.id,
      });
      if (isPaid) {
        removeProofs(proofs);
        addProofs(change);
      }
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to melt tokens", details: error });
    }
  };
 

  const handleSwapSend = async () => {
    const swapAmount = parseInt(formData.swapAmount);
    const proofs = getProofsByAmount(swapAmount);
 
    if (proofs.length === 0) {
      alert("Insufficient balance");
      return;
    }
 
    try {
      const { send, returnChange } = await wallet.send(swapAmount, proofs);
 
      const encodedToken = getEncodedToken({
        token: [{ proofs: send, mint: wallet.mint.mintUrl }],
      });
 
      removeProofs(proofs);
      addProofs(returnChange);
      setDataOutput(encodedToken);
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to swap tokens", details: error });
    }
  };
 

  const handleSwapClaim = async () => {
    const token = formData.swapToken;
 
    try {
      const { token: newToken, tokensWithErrors } = await wallet.receive(token);
 
      const { proofs } = newToken.token[0];
 
      addProofs(proofs);
      setDataOutput(proofs);
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to claim swap tokens", details: error });
    }
  };
 

  return (
    <main>
      <div className="cashu-operations-container">
        <div className="section">
          <label htmlFor="mint-url">Mint URL:</label>
          <input
            type="text"
            name="mintUrl"
            className="mint-url"
            value={formData.mintUrl}
            onChange={handleChange}
          />
          <button className="mint-connect-button" onClick={handleSetMint}>
            Set Mint
          </button>
        </div>

        <div className="section">
          <h2>Minting Tokens</h2>
          <label htmlFor="mint-amount">Amount:</label>
          <input
            type="number"
            name="mintAmount"
            className="mint-amount"
            value={formData.mintAmount}
            onChange={handleChange}
          />
          <button className="mint-button" onClick={handleMint}>
            Mint
          </button>
        </div>

        <div className="section">
          <h2>Melt Tokens</h2>
          <label htmlFor="melt-invoice">Bolt11 Invoice:</label>
          <input
            type="text"
            name="meltInvoice"
            className="melt-invoice"
            value={formData.meltInvoice}
            onChange={handleChange}
          />
          <button className="melt-button" onClick={handleMelt}>
            Melt
          </button>
        </div>

        <div className="section">
          <h2>Swap Tokens</h2>
          <label htmlFor="swap-amount">Amount:</label>
          <input
            type="number"
            name="swapAmount"
            className="swap-amount"
            value={formData.swapAmount}
            onChange={handleChange}
          />
          <button className="swap-send-button" onClick={handleSwapSend}>
            Swap to Send
          </button>
          <label htmlFor="swap-token">Token:</label>
          <input
            type="text"
            name="swapToken"
            className="swap-token"
            value={formData.swapToken}
            onChange={handleChange}
          />
          <button className="swap-claim-button" onClick={handleSwapClaim}>
            Swap to Claim
          </button>
        </div>
      </div>

      <div className="data-display-container">
        <h2>Balance: {balance}</h2>
        <pre id="data-output" className="data-output">
          {JSON.stringify(dataOutput, null, 2)}
        </pre>
      </div>
    </main>
  );
};

export default Wallet;
