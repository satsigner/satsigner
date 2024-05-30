import { Modal, StyleSheet, View } from "react-native";
import { useEffect, useState } from "react";

import { NavigationProp } from "@react-navigation/native";

import SelectedUtxosHeader from "../../components/accounts/SelectedUtxosHeader";
import Button from "../../components/shared/Button";
import { Colors, Layout } from "../../styles";
import { useAccountsContext } from "../../components/accounts/AccountsContext";
import navUtils from "../../utils/NavUtils";
import { Output } from "../../models/Output";

import AddOutputModal from "./components/AddOutputModal";

interface Props {
  navigation: NavigationProp<any>
}

export default function InputsOutputsPreviewScreen({
  navigation
}: Props) {
  const { currentAccount } = useAccountsContext();
  const [ addOutputModalVisible, setAddOutputModalVisible ] = useState(false);

  useEffect(() => {
    navUtils.setHeaderTitle(currentAccount.name, navigation);
  }, []);

  const addOutput = (output?: Output) => {
    if (output) {
      console.log('adding output', output);
    }
    setAddOutputModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <SelectedUtxosHeader toggleScreenAction="list" navigation={navigation} />
      <View style={styles.bottomContainer}>
        <Button
          title="Add Output"
          style={styles.addOutput}
          onPress={() => setAddOutputModalVisible(true)}
        ></Button>
      </View>
      <Modal
        visible={addOutputModalVisible}
        transparent={false}
      >
        <AddOutputModal
          onClose={addOutput}
        ></AddOutputModal>
      </Modal>
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