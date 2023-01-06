import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import {G, Path, Svg, Rect, Text, TSpan} from 'react-native-svg';

const SankeyTransactionNode = ({ name, x0, x1, y0, y1, color }: {name: string, x0: number, x1: number, y0: number, y1: number, color: string}) => (
  <Rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={color}>
  </Rect>
);

const SankeyInputOutputNode = ({ name, value, x0, x1, y0, y1, color }: {name: string, x0: number, x1: number, y0: number, y1: number, color: string}) => (
  <Text
    fill="white"
    stroke="white"
    fontSize="12"
    fontWeight="100"
    x={x0}
    y={y0 + ((y1 - y0) / 2)}
    textAnchor="middle"
  >
    <TSpan x={x0}>{toSats(value)} sats</TSpan>
    <TSpan x={x0} dy="12" fontSize="10">{name}</TSpan>
  </Text>
);

const SankeyLink = ({ link, color }) => (
  <Path
    d={sankeyLinkHorizontal()(link)}
    fill="none"
    stroke={color}
    strokeWidth={Math.max(4, link.width)}
  />
);

const TransactionSankey = ({ data, width, height }) => {
  const { nodes, links } = sankey()
    .nodeWidth(40)
    .nodePadding(80)
    .extent([[25, 0], [width-25, height-25]])(data);

  return (
    <Svg width={width} height={height}>
      <G>
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
      </G>
    </Svg>
  );
};

function toSats(btc: number) {
  return Math.round(btc * 100_000_000);
}

export default TransactionSankey;
