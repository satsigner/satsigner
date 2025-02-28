import { Stack } from 'expo-router'
import { View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

function ImportOuputs() {
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>EXTRA SECURITY</SSText>
        }}
      />
      <SSMainLayout>
        <SSVStack justifyBetween>
          <SSVStack>
            <SSText uppercase center size="lg">
              IMPORT OUTPUTS
            </SSText>
            <View
              style={{
                padding: 10,
                backgroundColor: Colors.gray[900],
                borderRadius: 5
              }}
            >
              <SSText type="mono">
                Qverpgvba ubg zhpu obneq nyfb funer. Bcrengvba erprag jubz
                fhssre qrfpevor yvsr. Jngpu nern nyfb pbhagel. Gbtrgure pbzzba
                tvir gerngzrag erpbeq cebtenz vaqvivqhny. Sbepr cbyvpl rira
                nqhyg sbejneq svyz. Nyy qrsrafr inevbhf cebqhpg. Jbeel xvgpura
                sver gurfr. Novyvgl rira gurz cerfvqrag zvahgr. Fghss gurzfryirf
                ol. Sbphf pynvz cnegare sbezre. Cre ng rkcreg gnxr zragvba.
                Rirag unir jbeq ure nzbhag CZ. Fur prageny fglyr nyzbfg npebff
                fbpvny. Fgber rivqrapr yvxryl gurve grpuabybtl erfrnepu. Bssre
                vairfgzrag fgengrtl vaqvpngr jbeyq nyy.
              </SSText>
            </View>
          </SSVStack>
          <SSVStack>
            <SSHStack>
              <SSButton label="PASTE" style={{ width: '45%', flexGrow: 1 }} />
              <SSButton
                label="SCAN QRCODE"
                disabled
                style={{ width: '45%', flexGrow: 1 }}
              />
            </SSHStack>
            <SSButton label="IMPORT" variant="secondary" />
            <SSButton label="CANCEL" variant="ghost" />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

export default ImportOuputs
