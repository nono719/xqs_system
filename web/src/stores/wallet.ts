import { defineStore } from "pinia";
import { ref } from "vue";
import { ethers } from "ethers";
import { api } from "@/api";

interface ContractInfo {
  address: string;
  chainId: number;
  rpcUrl: string;
  abi: any[];
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const useWallet = defineStore("wallet", () => {
  const account = ref<string | null>(null);
  const chainId = ref<number | null>(null);
  const contractInfo = ref<ContractInfo | null>(null);
  const provider = ref<ethers.providers.Web3Provider | null>(null);
  const error = ref<string | null>(null);

  async function loadContractInfo() {
    const { data } = await api.get("/chain/contract");
    contractInfo.value = data;
    return data as ContractInfo;
  }

  async function connect(): Promise<{ account: string; chainId: number }> {
    error.value = null;
    if (!window.ethereum) {
      error.value = "请先安装 MetaMask 插件";
      throw new Error("NO_METAMASK");
    }
    const p = new ethers.providers.Web3Provider(window.ethereum, "any");
    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
    const network = await p.getNetwork();
    account.value = accounts[0];
    chainId.value = network.chainId;
    provider.value = p;

    window.ethereum.on?.("accountsChanged", (accs: string[]) => {
      account.value = accs[0] ?? null;
    });
    window.ethereum.on?.("chainChanged", (cidHex: string) => {
      chainId.value = parseInt(cidHex, 16);
    });

    return { account: account.value!, chainId: chainId.value! };
  }

  function getContract(): ethers.Contract {
    if (!provider.value) throw new Error("钱包未连接");
    if (!contractInfo.value?.address) throw new Error("合约未部署");
    return new ethers.Contract(
      contractInfo.value.address,
      contractInfo.value.abi,
      provider.value.getSigner()
    );
  }

  return { account, chainId, contractInfo, provider, error, connect, loadContractInfo, getContract };
});
