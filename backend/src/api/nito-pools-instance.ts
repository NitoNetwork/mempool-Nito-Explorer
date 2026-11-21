import { NitoPools } from './nito-pools';
import bitcoinClient from './bitcoin/bitcoin-client';
import config from '../config';
import nitoActivation from './nito-activation-instance';

const pools = new NitoPools(bitcoinClient, config.MEMPOOL.NETWORK, () => nitoActivation.getChainInfo());
nitoActivation.subscribe(state => { if (state.status === 'unknown') { pools.invalidate(); } });
export default pools;
