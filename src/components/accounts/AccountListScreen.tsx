import React from 'react';
import { View, ScrollView } from 'react-native';

import Accounts from './AccountsList/Accounts';
import Button from '../shared/Button';
import { AppText } from '../shared/AppText';
import { styles } from './AccountsList/styles';
import { AccountsContext } from './AccountsContext';

interface Props {}

interface State {}

export default class AccountListScreen extends React.PureComponent<
  Props,
  State
> {
  static contextType = AccountsContext;

  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <AccountsContext.Consumer>
        {({ accounts }) => (
          <>
            <View style={styles.createButtonContainer}>
              <Button
                gradientBackground={true}
                style={styles.createButton}
                title="Add Master Key"
                onPress={() =>
                  this.props.navigation.navigate('CreateParentAccount')
                }
              />
            </View>
            <View style={styles.container}>
              <ScrollView style={styles.scrollContainer}>
                {accounts?.length === 0 && (
                  <View style={styles.emptyList}>
                    <AppText style={styles.emptyListText}>No Keys Yet</AppText>
                  </View>
                )}
                <View>
                  <Accounts accounts={accounts} />
                </View>
              </ScrollView>
            </View>
          </>
        )}
      </AccountsContext.Consumer>
    );
  }
}
