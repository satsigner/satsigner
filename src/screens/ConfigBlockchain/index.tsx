import { ScrollView, StyleSheet, TextInput, View } from "react-native";

import { NavigationProp } from "@react-navigation/native";

import { Colors, Layout, Typography } from "../../styles";
import { useBlockchainContext } from "../../components/accounts/BlockchainContext";

import Button from "../../components/shared/Button";
import CheckboxGroup from "../../components/shared/CheckboxGroup";
import { AppText } from "../../components/shared/AppText";
import { Backend } from "../../enums/Backend";
import { Network } from "../../enums/Network";
import { useEffect, useState } from "react";
import KeyboardAvoidingViewWithHeaderOffset from "../../components/shared/KeyboardAvoidingViewWithHeaderOffset";

interface Props {
  navigation: NavigationProp<any>;
}

export default function ConfigBlockchainScreen({ navigation }: Props) {
  const blockchainContext = useBlockchainContext();

  const [ disabled, setDisabled ] = useState(false);
  const [ network, setNetwork ] = useState(blockchainContext.network);
  const [ backend, setBackend ] = useState(blockchainContext.backend);
  const [ url, setUrl ] = useState(blockchainContext.url);

  const backends = [ Backend.Electrum, Backend.Esplora ];
  const networks = [ Network.Testnet, Network.Signet ];

  useEffect(() => {
    setDisabled(! valid());
  }, [network, backend, url])

  const cancel = () => {
    navigation.navigate('Home');
  };

  const save = () => {
    blockchainContext.setBackend(backend);
    blockchainContext.setNetwork(network);
    blockchainContext.setUrl(url);
    navigation.navigate('Home');
  };

  const valid = () => {
    const urlRegex = /\w{2,10}:\/\/\w/;
    return backend && network && url.match(urlRegex);
  };

  const onBackendChecked = (backend: Backend) => {
    setBackend(backend);
  };

  const onNetworkChecked = (network: Network) => {
    setNetwork(network);
  };

  const onUrlChanged = (updatedUrl: string) => {
    setUrl(updatedUrl);
  };

  return (
    <KeyboardAvoidingViewWithHeaderOffset style={styles.container}>
      <ScrollView>
        <View>
          <AppText style={styles.label}>
            Backend
          </AppText>
          <CheckboxGroup
            initialValue={backend}
            values={backends}
            onChecked={onBackendChecked}
          ></CheckboxGroup>
        </View>
        <View>
          <AppText style={styles.label}>
            Network
          </AppText>
          <CheckboxGroup
            initialValue={network}
            values={networks}
            onChecked={onNetworkChecked}
          ></CheckboxGroup>
        </View>
        <View>
          <AppText style={styles.label}>
            URL
          </AppText>
          <TextInput
            style={styles.urlText}
            value={url}
            onChangeText={onUrlChanged}
          >
          </TextInput>
        </View>
      </ScrollView>

      <View>
        <Button
          title="Save"
          style={ disabled ? styles.submitDisabled : styles.submitEnabled }
          disabled={disabled}
          onPress={save}
        ></Button>
        <Button
          title='Cancel'
          onPress={cancel}
          style={styles.cancel}
        ></Button>
      </View>
    </KeyboardAvoidingViewWithHeaderOffset>
  );
}

const styles = StyleSheet.create({
  container: {
    ...Layout.container.base,
    ...Layout.container.horizontalPadded,
    ...Layout.container.topPadded,
  },
  submitEnabled: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText,
  },
  submitDisabled: {
    backgroundColor: Colors.disabledActionBackground,
    color: Colors.disabledActionText
  },
  cancel: {
    backgroundColor: Colors.cancelActionBackground,
    color: Colors.cancelActionText,
    marginBottom: 42
  },
  label: {
    marginTop: 12,
    marginBottom: 39,
    ...Typography.capitalization.uppercase
  },
  urlText: {
    ...Typography.textHighlight.x12,
    backgroundColor: Colors.inputBackground,
    height: 56,
    borderRadius: 3,
    paddingLeft: 12
  }
});
