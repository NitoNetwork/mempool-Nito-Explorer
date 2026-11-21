import { NitoActivation } from './nito-activation';
import bitcoinClient from './bitcoin/bitcoin-client';
import config from '../config';

export default new NitoActivation(bitcoinClient, config.MEMPOOL.NETWORK);
