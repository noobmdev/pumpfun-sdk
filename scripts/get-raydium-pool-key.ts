import { PublicKey, Connection } from "@solana/web3.js";
import BN from "bn.js";

const ammConfigs = [
	new PublicKey("2fGXL8uhqxJ4tpgtosHZXT4zcQap6j62z3bMDxdkMvy5"),
	new PublicKey("C7Cx2pMLtjybS3mDKSfsBj4zQ3PRZGkKt7RCYTTbCSx2"),
	new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc"),
	new PublicKey("D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2"),
];

(async () => {
	const tokenA = new PublicKey("So11111111111111111111111111111111111111112"); // SOL
	const tokenB = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC

	const isFront = new BN(tokenA.toBuffer()).lte(new BN(tokenB.toBuffer()));
	const [token0, token1] = isFront ? [tokenA, tokenB] : [tokenB, tokenA];

	const poolKeys = ammConfigs.map(
		(e) =>
			PublicKey.findProgramAddressSync(
				[
					Buffer.from("pool", "utf8"),
					e.toBuffer(),
					token0.toBuffer(),
					token1.toBuffer(),
				],
				new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C") // Raydium Cpmm
			)[0]
	);

	const connection = new Connection("https://api.mainnet-beta.solana.com", {
		commitment: "confirmed",
	});

	const accountInfos = await Promise.allSettled(
		poolKeys.map((p) => connection.getAccountInfo(p))
	);

	const keys = accountInfos.reduce((acc, cur, idx) => {
		// @ts-expect-error
		if (cur?.value) acc.push(poolKeys[idx]);
		return acc;
	}, []);

	console.log(`Pool keys of ${tokenA.toString()} and ${tokenB.toString()}`);
	console.table(keys.map((k) => k.toString()));
})();
