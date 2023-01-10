import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import {
  Canvas,
  Path,
  Rect,
  Group,
  Text,
  Skia,
  useFont
} from '@shopify/react-native-skia';

const SankeyTransactionNode = ({ name, x0, x1, y0, y1, color }: {name: string, x0: number, x1: number, y0: number, y1: number, color: string}) => (
  <Rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} color={color}>
  </Rect>
);

const SankeyInputOutputNode = ({ name, value, x0, x1, y0, y1, color }: {name: string, x0: number, x1: number, y0: number, y1: number, color: string}) => (
  <Group>
    <Text
      color="white"
      font={useFont(require('../../SF-Pro.ttf'), 12)}
      x={x0}
      y={y0 + ((y1 - y0) / 2)}
      text={toSats(value) + ' sats'}
    />
    <Text
      color="white"
      font={useFont(require('../../SF-Pro.ttf'), 10)}
      x={x0}
      y={y0 + ((y1 - y0) / 2) + 12}
      text={name}
    />
  </Group>
);

const SankeyLink = ({ link, color }) => (
  <Path
    style="stroke"
    path={getSkiaCurve(sankeyLinkHorizontal()(link))}
    strokeWidth={Math.max(4, link.width)}
    color={color}
  />
);

const getSkiaCurve = (pathDefinition: string) => Skia.Path.MakeFromSVGString(pathDefinition!);

const TransactionSankey = ({ data, width, height }) => {
  const GRAPH_HEIGHT = 225;
  const GRAPH_WIDTH = 375;
  const { nodes, links } = sankey()
    .nodeWidth(40)
    .nodePadding(80)
    .extent([[15, 0], [width-35, height-25]])(data);

  return (
    <Canvas
        style={{
          width: GRAPH_WIDTH,
          height: GRAPH_HEIGHT,
        }}>
        {links.map((link, i) => (
          <SankeyLink
            link={link}
            color={"#252525"}
            key={link.index}
          />
        ))}
        {nodes.map((node, i) => 
          node.type === 'transaction' ?
            (
              <SankeyTransactionNode
                {...node}
                color="white"
                key={node.name}
              />
            )
            :
            (
              <SankeyInputOutputNode
                {...node}
                key={node.name}
              />
            )
        )}
      </Canvas>
  );
};

function toSats(btc: number) {
  return Math.round(btc * 100_000_000);
}

export default TransactionSankey;
