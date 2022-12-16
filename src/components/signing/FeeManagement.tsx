import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import GlobalStyles from '../../GlobalStyles';
import Header from '../shared/Header';

interface Props {}

interface State {}

const FeeManagement = () => {
    return (
        <View>
            <Header heading='Extra Security'></Header>
        </View>
    );
}

export default FeeManagement;

const styles = StyleSheet.create({  
  container: {
    flex: 1
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    marginTop: 30,
    paddingHorizontal: '6%'
  },
  accountNameLabel: {
    ...GlobalStyles.text,
    alignSelf: 'center',
    marginBottom: 7
  },
  accountNameText: {
    ...GlobalStyles.text,
    backgroundColor: '#242424',
    fontSize: 20,
    fontWeight: '300',
    textAlign: 'center',
    padding: 13.6,
    borderRadius: 3,
    letterSpacing: 0.6
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 36
  },
});
