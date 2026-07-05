export const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const PASSTHROUGH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_videoFrame;
void main() {
  vec2 mirroredCoord = vec2(1.0 - v_texCoord.x, v_texCoord.y);
  fragColor = texture(u_videoFrame, mirroredCoord);
}
`;

export const REPLACE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_videoFrame;
uniform sampler2D u_background;
uniform sampler2D u_mask;
uniform float u_edgeLow;
uniform float u_edgeHigh;
void main() {
  vec2 mirroredCoord = vec2(1.0 - v_texCoord.x, v_texCoord.y);
  vec4 personColor = texture(u_videoFrame, mirroredCoord);
  vec4 bgColor = texture(u_background, v_texCoord);
  float maskValue = texture(u_mask, mirroredCoord).r;
  float alpha = smoothstep(u_edgeLow, u_edgeHigh, maskValue);
  fragColor = mix(bgColor, personColor, alpha);
}
`;

export const BLUR_H_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_source;
uniform vec2 u_texelSize;
uniform float u_blurRadius;

const float W[8] = float[8](
  0.10611, 0.10284, 0.09364, 0.08010,
  0.06436, 0.04858, 0.03445, 0.02295
);

void main() {
  vec2 baseCoord = vec2(1.0 - v_texCoord.x, v_texCoord.y);
  vec4 result = texture(u_source, baseCoord) * W[0];
  for (int i = 1; i < 8; ++i) {
    float dx = float(i) * u_blurRadius * u_texelSize.x;
    result += texture(u_source, baseCoord + vec2(dx, 0.0)) * W[i];
    result += texture(u_source, baseCoord + vec2(-dx, 0.0)) * W[i];
  }
  fragColor = result;
}
`;

export const BLUR_V_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_blurredH;
uniform sampler2D u_videoFrame;
uniform sampler2D u_mask;
uniform vec2 u_texelSize;
uniform float u_blurRadius;
uniform float u_edgeLow;
uniform float u_edgeHigh;

const float W[8] = float[8](
  0.10611, 0.10284, 0.09364, 0.08010,
  0.06436, 0.04858, 0.03445, 0.02295
);

void main() {
  vec4 blurred = texture(u_blurredH, v_texCoord) * W[0];
  for (int i = 1; i < 8; ++i) {
    float dy = float(i) * u_blurRadius * u_texelSize.y;
    blurred += texture(u_blurredH, v_texCoord + vec2(0.0, dy)) * W[i];
    blurred += texture(u_blurredH, v_texCoord + vec2(0.0, -dy)) * W[i];
  }
  vec2 mirroredCoord = vec2(1.0 - v_texCoord.x, v_texCoord.y);
  vec4 original = texture(u_videoFrame, mirroredCoord);
  float maskValue = texture(u_mask, mirroredCoord).r;
  float alpha = smoothstep(u_edgeLow, u_edgeHigh, maskValue);
  fragColor = mix(blurred, original, alpha);
}
`;
