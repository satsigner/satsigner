import { StyleSheet, View } from "react-native";
import { useEffect } from "react";

import { NavigationProp } from "@react-navigation/native";

import SelectedUtxosHeader from "../../components/accounts/SelectedUtxosHeader";
import Button from "../../components/shared/Button";
import notImplementedAlert from "../../components/shared/NotImplementedAlert";
import { Colors, Layout } from "../../styles";
import { useAccountsContext } from "../../components/accounts/AccountsContext";
import navUtils from "../../utils/NavUtils";

interface Props {
  navigation: NavigationProp<any>
}

export default function InputsOutputsPreviewScreen({
  navigation
}: Props) {
  const { currentAccount } = useAccountsContext();

  useEffect(() => {
    navUtils.setHeaderTitle(currentAccount.name, navigation);
  }, []);

  return (
    <View style={styles.container}>
      <SelectedUtxosHeader toggleScreenAction="list" navigation={navigation} />
      <View style={styles.bottomContainer}>
        <Button
          title="Add Output"
          style={styles.addOutput}
          onPress={notImplementedAlert}
        ></Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...Layout.container.base,
    ...Layout.container.topPaddedThin,
    justifyContent: 'space-between'
  },
  addOutput: {
    width: '92%',
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText
  },
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 20,
    width: '100%'
  },
})