import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'fill'>

export default function SSIconWalletEye({
  width = 20,
  height = 20,
  fill = '#fff'
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 512 512"
      preserveAspectRatio="xMidYMid meet"
    >
      <G
        transform="translate(0.000000,512) scale(0.100000,-0.100000)"
        fill={fill}
      >
        <G>
          <Path d="M957 3824 c-163 -39 -326 -168 -404 -319 -62 -121 -73 -175 -73 -374 l0 -171 159 0 158 0 5 154 c5 136 8 160 30 208 36 77 80 123 156 160 l67 33 1505 0 1505 0 55 -26 c80 -37 125 -81 162 -157 l33 -67 5 -756 5 -756 115 -60 c63 -32 133 -71 155 -86 l40 -27 3 856 c2 960 5 922 -70 1068 -80 154 -243 281 -409 321 -93 22 -3112 21 -3202 -1z" />
        </G>
        <G>
          <Path d="M232 2700 c-18 -11 -41 -34 -52 -52 -19 -32 -20 -52 -20 -648 0 -596 1 -616 20 -648 11 -18 34 -41 52 -52 32 -19 52 -20 554 -20 485 0 526 1 598 20 248 63 453 268 516 516 27 105 27 263 0 368 -63 248 -268 453 -516 516 -72 19 -113 20 -598 20 -502 0 -522 -1 -554 -20z m1012 -309 c136 -18 256 -105 314 -229 24 -50 27 -69 27 -162 0 -93 -3 -112 -27 -162 -57 -123 -174 -208 -313 -228 -38 -5 -226 -10 -417 -10 l-348 0 0 400 0 400 348 0 c191 -1 378 -5 416 -9z" />
          <G>
            <Path d="M1112 2140 c-48 -30 -72 -75 -72 -140 0 -100 60 -160 160 -160 100 0 160 60 160 160 0 65 -24 110 -72 140 -45 27 -131 27 -176 0z" />
          </G>
        </G>
        <G>
          <Path d="M3246 1665 c-286 -47 -548 -154 -785 -323 -103 -73 -343 -298 -367 -343 -18 -36 -18 -122 0 -158 24 -45 264 -270 367 -343 224 -160 452 -257 737 -315 125 -26 519 -26 644 0 285 58 513 155 737 315 103 73 343 298 367 343 18 36 18 122 0 158 -24 45 -264 270 -367 343 -223 159 -454 258 -729 314 -117 23 -480 29 -604 9z m412 -440 c165 -74 244 -277 170 -437 -124 -268 -481 -273 -610 -10 -28 57 -33 76 -33 142 1 247 248 406 473 305z m-763 -69 c-55 -146 -55 -326 0 -472 15 -39 20 -64 13 -64 -37 0 -282 160 -373 245 l-60 55 60 55 c93 86 335 245 372 245 8 0 4 -21 -12 -64z m1312 29 c134 -74 353 -238 353 -265 0 -14 -144 -134 -222 -186 -82 -54 -191 -114 -206 -114 -7 0 -2 24 13 64 55 146 55 326 0 472 -15 40 -20 64 -13 64 6 0 40 -16 75 -35z" />
        </G>
        <G>
          <Path d="M480 873 c0 -199 12 -261 72 -377 57 -110 154 -207 264 -264 143 -74 116 -72 979 -72 l770 1 -40 23 c-111 67 -220 143 -307 215 l-98 81 -487 0 c-293 0 -514 4 -553 11 -118 19 -199 80 -248 187 -22 48 -25 72 -30 208 l-5 154 -158 0 -159 0 0 -167z" />
        </G>
      </G>
    </Svg>
  )
}
