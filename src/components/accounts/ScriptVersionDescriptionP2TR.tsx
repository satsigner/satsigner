import Link from '../shared/Link';
import { AppText } from '../shared/AppText';

import P2PkhScript from '../../assets/images/scripts/p2pkh-script.svg';

export function ScriptVersionDescriptionP2TR(props) {
  const textStyle = props.textStyle;
  
  return (
    <>
    <AppText style={textStyle}>

      *TAPROOT placeholder* A type of
      <Link text='ScriptPubKey' url='https://river.com/learn/terms/s/scriptpubkey/' />
      which locks bitcoin to the hash of a public key. A P2PKH transaction is one where
      the inputs were locked using the P2PKH ScriptPubKey.
      
    </AppText>

    <P2PkhScript style={{marginVertical: 8}} width='100%' height='90'></P2PkhScript>
    </>
  );
}
