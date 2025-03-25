import { Component } from 'react'
import { NativeFixtureLoader } from 'react-cosmos-native'

// INFO: the file cosmos.imports is not tracked by git and used only in local
// development, therefore we need to disable typescript checking this line.
//
// @ts-ignore:next-line
import { moduleWrappers, rendererConfig } from '../cosmos.imports'

export default class CosmosApp extends Component {
  render() {
    return (
      <NativeFixtureLoader
        rendererConfig={rendererConfig}
        moduleWrappers={moduleWrappers}
      />
    )
  }
}
