import { useWindowDimensions, View } from "react-native";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";

import { Colors, Typography } from "@/styles";

const VB_W = 360;
const VB_H = 520;
const STROKE = "rgba(255,255,255,0.42)";
const STROKE_SOFT = "rgba(255,255,255,0.18)";
const LABEL_FILL = "rgba(255,255,255,0.55)";
const NODE_STROKE = "rgba(255,255,255,0.5)";
const NODE_FILL = "rgba(255,255,255,0.06)";

type SSSignSendSankeyIllustrationVariant = "default" | "minimal";

type Flow = { d: string; key: string };

const FLOWS: Flow[] = [
  {
    d: "M 88 128 C 112 122 128 178 142 188",
    key: "in1",
  },
  {
    d: "M 88 248 C 112 255 128 232 142 258",
    key: "in2",
  },
  {
    d: "M 234 188 C 252 150 260 115 272 96",
    key: "out1",
  },
  {
    d: "M 234 248 C 252 248 262 242 272 236",
    key: "out2",
  },
  {
    d: "M 234 292 C 252 318 262 338 272 358",
    key: "out3",
  },
];

type SSSignSendSankeyIllustrationProps = {
  variant?: SSSignSendSankeyIllustrationVariant;
};

function SSSignSendSankeyIllustration({
  variant = "default",
}: SSSignSendSankeyIllustrationProps) {
  const { height, width } = useWindowDimensions();
  const svgH = Math.min(height * 0.62, VB_H * 1.2);
  const showLabels = variant === "default";

  return (
    <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
      <Svg
        height={svgH}
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width={width}
      >
        {FLOWS.map((flow) => (
          <Path
            key={flow.key}
            d={flow.d}
            fill="none"
            stroke={STROKE_SOFT}
            strokeLinecap="round"
            strokeWidth={7}
          />
        ))}
        {FLOWS.map((flow) => (
          <Path
            key={`${flow.key}-core`}
            d={flow.d}
            fill="none"
            stroke={STROKE}
            strokeLinecap="round"
            strokeWidth={2.5}
          />
        ))}

        <Rect
          fill={NODE_FILL}
          height={40}
          rx={6}
          stroke={NODE_STROKE}
          strokeWidth={1}
          width={76}
          x={12}
          y={108}
        />
        {showLabels ? (
          <SvgText
            fill={LABEL_FILL}
            fontFamily={Typography.sfProTextLight}
            fontSize={11}
            x={18}
            y={155}
          >
            Prior spend
          </SvgText>
        ) : null}

        <Rect
          fill={NODE_FILL}
          height={40}
          rx={6}
          stroke={NODE_STROKE}
          strokeWidth={1}
          width={76}
          x={12}
          y={228}
        />
        {showLabels ? (
          <SvgText
            fill={LABEL_FILL}
            fontFamily={Typography.sfProTextLight}
            fontSize={11}
            x={18}
            y={285}
          >
            Coinjoin mix
          </SvgText>
        ) : null}

        <Rect
          fill={NODE_FILL}
          height={188}
          rx={10}
          stroke={NODE_STROKE}
          strokeWidth={1}
          width={92}
          x={142}
          y={154}
        />
        {showLabels ? (
          <SvgText
            fill={LABEL_FILL}
            fontFamily={Typography.sfProTextLight}
            fontSize={11}
            x={148}
            y={148}
          >
            Transaction
          </SvgText>
        ) : null}

        <Rect
          fill={NODE_FILL}
          height={36}
          rx={6}
          stroke={NODE_STROKE}
          strokeWidth={1}
          width={80}
          x={272}
          y={78}
        />
        {showLabels ? (
          <SvgText
            fill={LABEL_FILL}
            fontFamily={Typography.sfProTextLight}
            fontSize={11}
            x={278}
            y={128}
          >
            Recipient
          </SvgText>
        ) : null}

        <Rect
          fill={NODE_FILL}
          height={36}
          rx={6}
          stroke={NODE_STROKE}
          strokeWidth={1}
          width={80}
          x={272}
          y={218}
        />
        {showLabels ? (
          <SvgText
            fill={LABEL_FILL}
            fontFamily={Typography.sfProTextLight}
            fontSize={11}
            x={278}
            y={268}
          >
            Change back
          </SvgText>
        ) : null}

        <Rect
          fill={NODE_FILL}
          height={36}
          rx={6}
          stroke={NODE_STROKE}
          strokeWidth={1}
          width={80}
          x={272}
          y={340}
        />
        {showLabels ? (
          <SvgText
            fill={LABEL_FILL}
            fontFamily={Typography.sfProTextLight}
            fontSize={11}
            x={278}
            y={390}
          >
            Miner fee
          </SvgText>
        ) : null}

        {showLabels ? (
          <SvgText
            fill={Colors.gray[500]}
            fontFamily={Typography.sfProTextLight}
            fontSize={10}
            x={12}
            y={24}
          >
            Illustration — flows trace how value moved on-chain
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

export default SSSignSendSankeyIllustration;
