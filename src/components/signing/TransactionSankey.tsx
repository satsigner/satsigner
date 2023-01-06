import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import {G, Line, Path, Svg, Rect, Text} from 'react-native-svg';

const SankeyTransactionNode = ({ name, x0, x1, y0, y1, color }: {name: string, x0: number, x1: number, y0: number, y1: number, color: string}) => (
  <Rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={color}>
    {/* <title>{name}</title> */}
  </Rect>
);

const SankeyInputOutputNode = ({ name, value, x0, x1, y0, y1, color }: {name: string, x0: number, x1: number, y0: number, y1: number, color: string}) => (
  <Text
    fill="white"
    stroke="white"
    fontSize="10"
    fontWeight="100"
    x={x0}
    y={y0}
    textAnchor="middle"
  >{toSats(value)} sats</Text>
  // <Rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="purple">
  // </Rect>
);

const SankeyLink = ({ link, color }) => (
  <Path
    d={sankeyLinkHorizontal()(link)}
    fill="none"
    stroke={color}
    // strokeOpacity="1.0"
    // strokeWidth={Math.max(1, link.width)}
    strokeWidth={Math.max(4, link.width)}
    // style={{
    //   fill: "none",
    //   strokeOpacity: "1.0",
    //   stroke: color,
    //   strokeWidth: Math.max(1, link.width)
    // }}
  />
);

const TransactionSankey = ({ data, width, height }) => {
  const { nodes, links } = sankey()
    .nodeWidth(40)
    .nodePadding(40)
    .extent([[1, 1], [width - 1, height - 5]])(data);

  return (
    <Svg width={width} height={height}>
      <G>
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
                color="red"
                key={node.name}
              />
            )
        )}
        {links.map((link, i) => (
          <SankeyLink
            link={link}
            color={"#252525"}
          />
        ))}
      </G>
    </Svg>
  );
};

function toSats(btc: number) {
  return Math.round(btc * 100_000_000);
}

export default TransactionSankey;
