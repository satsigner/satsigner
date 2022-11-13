import React from 'react';
import {StyleSheet, View} from 'react-native';
import mempoolJS from '@mempool/mempool.js';
import axios from 'axios';
import {MempoolGraphComponent} from './components/MempoolFeesChart';

// statistics api endpoint (for historical mempool fee distribution chart):
const mempoolStatsEndpoint = 'https://mempool.space/api/v1/statistics/';

interface State {
  ws: WebSocket;
  mempoolVsizeFeesData: {labels: any[]; series: number[][][]};
  data: {}[];
}

export default class App extends React.Component<{}, State> {
  constructor(props: any) {
    super(props);

    const {
      bitcoin: {websocket},
    } = mempoolJS({
      hostname: 'mempool.space',
    });

    const clientOptions = {
      options: ['blocks', 'stats', 'mempool-blocks', 'live-2h-chart'],
    };

    this.state = {
      ws: websocket.initClient(clientOptions),
      mempoolVsizeFeesData: {labels: [], series: []},
      data: [],
    };
  }

  componentDidMount = async () => {
    const data = await this.fetchMempoolStats();
    const mempoolParsedData = this.handleNewMempoolData(data.concat([]));

    this.setState({
      mempoolVsizeFeesData: mempoolParsedData,
      data,
    });
  };

  componentWillUnmount() {
    this.state.ws.close();
  }

  async fetchMempoolStats() {
    let mempoolData = await axios({
      method: 'get',
      url: mempoolStatsEndpoint + '2h',
    });
    return mempoolData.data;
  }

  handleNewMempoolData(mempoolStats: any[]) {
    const labels = mempoolStats.map(stats => stats.added);
    const finalArrayVByte = this.generateArray(mempoolStats);

    return {
      labels: labels,
      series: finalArrayVByte,
    };
  }

  generateArray(mempoolStats: any[]) {
    const finalArray: number[][][] = [];
    let feesArray: number[][] = [];
    const limitFeesTemplate = 20;
    for (let i = limitFeesTemplate; i > -1; i--) {
      feesArray = [];
      mempoolStats.forEach(stats => {
        feesArray.push([
          stats.added * 1000,
          stats.vsizes[i] ? stats.vsizes[i] : 0,
        ]);
      });
      finalArray.push(feesArray);
    }
    finalArray.reverse();
    return finalArray;
  }

  render() {
    return (
      <View style={styles.container}>
        <MempoolGraphComponent data={this.state.data} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5fcff',
  },
});
