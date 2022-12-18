import React from 'react';
import {
  View,
  StyleSheet,
  Text,
} from 'react-native';
import GlobalStyles from '../../GlobalStyles';
import Button from '../shared/Button';
import Header from '../shared/Header';

interface Props {}

interface State {}

const InputHistoryExplorer = () => {
    return (
        <View style={GlobalStyles.view}>
            <Header heading='Extra Security'></Header>
            <Text style={styles.numberOfOutputsText}>Spending X of Y outputs</Text>
            <View style={styles.amount}>
              <Text style={styles.satsAmountText}>14,476</Text>
              <Text style={styles.satsText}>sats</Text>
            </View>
            <Text style={styles.fiatAmountText}>26.34 USD</Text>
            <View style={styles.inOutButtonsContainer}>
              <Button 
                style={styles.inOutButton} 
                textStyle={styles.inOutButtonText} 
                title={"Add Input"} 
                onPress={() => {}} 
              />
              <Button 
                style={styles.inOutButton} 
                textStyle={styles.inOutButtonText} 
                title={"Add Output"} 
                onPress={() => {}} 
              />
            </View>
            <View style={styles.signMessageButtonContainer}>
              <Button 
                style={styles.signMessageButton} 
                textStyle={styles.signMessageButtonText} 
                title={"Sign Message"} 
                onPress={() => {}} 
              />
            </View>
        </View>
    );
}

export default InputHistoryExplorer;

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
  numberOfOutputsText: {
    ...GlobalStyles.text,
    alignSelf: 'center',
    marginBottom: 7,
    marginTop: 10
  },
  satsAmountText: {
    ...GlobalStyles.text,
    fontSize: 45,
    fontWeight: '300',
    textAlign: 'right',
    letterSpacing: 0.6,
  },
  satsText: {
    ...GlobalStyles.text,
    color: '#575757',
    fontSize: 18,
  },
  fiatAmountText: {
    ...GlobalStyles.text,
    alignSelf: 'center',
    fontSize: 11
  },
  amount: {
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end'  
  },
  inOutButton: {
    backgroundColor: '#131313',
    borderColor: 'white',
    borderWidth: 2,
    maxWidth: '50%',
    marginHorizontal: 5,
    flexGrow: 1
  },
  inOutButtonText: {
    color: 'white'
  },
  inOutButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  signMessageButtonText: {
    color: 'black'
  },
  signMessageButton: {
    ...GlobalStyles.button,
    backgroundColor: 'white',
  },
  signMessageButtonContainer: {
  },
});
