const HELP_CONTENT = {
  aomaster: {
    title: "AOMaster 曲线说明",
    html: `
      <p>AOMaster 监测面板显示<strong>双曲线</strong>：上方为设定预览，下方为轮询回读的实际输出。</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>设定预览</h3>
          <p>根据当前波形参数（恒定、阶跃、方波、锯齿等）在本地生成预览曲线，不依赖设备回包。</p>
        </article>
        <article class="protocol-example-card">
          <h3>实时输出</h3>
          <p>轮询读取寄存器 <code>0x0006</code> 的实际输出值；百分比/工程值显示模式可在设备页切换。</p>
        </article>
      </div>
      <div class="protocol-note">
        <strong>采样：</strong>
        <span>曲线总点数与显示点数在监测面板底部设置；点数越高历史越长，显示点数决定当前窗口宽度。</span>
      </div>
    `,
  },
  modbus: {
    title: "Modbus RTU 曲线说明",
    html: `
      <p>读模式（功能码 <code>03/04</code>）下，监测面板从 RTU 回包的<strong>数据区</strong>按字节偏移解码数值；写模式仅发送命令，不绘制曲线。</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. 单曲线（UInt16）</h3>
          <p>曲线一数据偏移 <code>0</code>，类型 UInt16，字节序 AB。读 1 个寄存器即可。</p>
          <pre><code>请求：01 03 00 00 00 01 84 0A
响应：01 03 02 00 64 B9 AF
数据区：00 64 → 100</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. 双曲线（同帧多寄存器）</h3>
          <p>曲线一偏移 <code>0</code>，曲线二偏移 <code>2</code>；读 2 个寄存器。偏移相对<strong>数据区首字节</strong>，不含从站/功能码/CRC。</p>
          <pre><code>响应：01 03 04 00 64 00 C8 FA 33
偏移 0 → 100，偏移 2 → 200</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. Float32</h3>
          <p>类型选 Float32 占 4 字节；32 位浮点需选 ABCD / DCBA 等字序。下一条曲线偏移至少 +4。</p>
          <pre><code>01 03 04 42 48 00 00 …
→ 50.0（取决于字序）</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>4. 比例与偏移</h3>
          <p>显示值 = 原始值 × 比例 + 偏移。例如原始 100、比例 0.1 → 显示 10.0。</p>
        </article>
      </div>
      <div class="protocol-note">
        <strong>配置分工：</strong>
        <span>设备页设置从站、功能码、起始地址、寄存器数量与轮询；监测面板设置每条曲线的名称、偏移、类型、字序与换算。启用多曲线时，若寄存器数量不足，会自动扩大读取范围。</span>
      </div>
      <div class="protocol-note">
        <strong>测试：</strong>
        <span>在曲线配置底部粘贴完整 RTU 帧 HEX（含 CRC），点「测试」验证解码，无需连接设备。</span>
      </div>
    `,
  },
  hart: {
    title: "HART 曲线说明",
    html: `
      <p>HART 设备搜索成功后，可轮询 PV / SV / TV / QV 四个主变量；卡片与曲线同步更新。</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>变量含义</h3>
          <p>PV 主变量、SV 次变量、TV 第三变量、QV 第四变量；单位随设备 DD 变化。</p>
        </article>
        <article class="protocol-example-card">
          <h3>显示开关</h3>
          <p>在曲线配置中勾选要绘制的变量；未勾选的不进入图表，但仍可在卡片查看。</p>
        </article>
      </div>
    `,
  },
  custom: {
    title: "自定义串口设备曲线说明",
    html: `
      <p>自定义串口设备通过发送模板下发设定，从回包中解析 JSON / HEX / Modbus 数值并绘图。</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. JSON 单/多曲线</h3>
          <p>解析模式 <code>JSON / 文本</code>；路径如 <code>value</code>、<code>data.temp</code>、<code>metrics.0.value</code>。</p>
          <pre><code>{"telemetry":{"temp":25.6,"pressure":1.23}}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. HEX 多曲线</h3>
          <p>模式 <code>HEX 原始字节</code>；曲线一偏移 0、曲线二偏移 2，按 UInt16/Int16/Float32 解码。</p>
          <pre><code>00 64 00 C8</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. 帧界与 CRC</h3>
          <p><code>行界</code> 按 CRLF/LF 切分；<code>帧头帧尾</code> 填 HEX（如 STX <code>02</code>、ETX <code>03</code>）；可选 Modbus CRC16 校验。</p>
        </article>
        <article class="protocol-example-card">
          <h3>4. Modbus 载荷</h3>
          <p>模式 <code>Modbus RTU</code>，配置从站与功能码，在同一 RTU 帧数据区内按偏移解多条曲线。</p>
          <pre><code>01 03 04 00 64 00 C8 FA 33</code></pre>
        </article>
      </div>
      <div class="protocol-note">
        <strong>分工：</strong>
        <span>设备页：名称、范围、发送模板；监测面板：解析模式、帧界、CRC、曲线字段。分片数据在连接期间缓冲至完整帧。</span>
      </div>
    `,
  },
  websocket: {
    title: "WebSocket 曲线说明",
    html: `
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. JSON 单曲线</h3>
          <p>解析模式 <code>JSON / 文本</code>，曲线一路径 <code>value</code>；留空路径时自动取第一个数字。</p>
          <pre><code>{"value":12.34}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. JSON 多曲线</h3>
          <p>最多 4 条；路径互不相同即可，如 <code>telemetry.temp</code> 与 <code>telemetry.pressure</code>。</p>
          <pre><code>{"telemetry":{"temp":25.6,"pressure":1.23,"flow":18.4}}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. HEX 多曲线</h3>
          <p>模式 <code>HEX 原始字节</code>；偏移为载荷内字节位置，非 Modbus 帧头。可配合行界/帧头帧尾切帧。</p>
          <pre><code>00 64 00 C8</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>4. Modbus RTU 载荷</h3>
          <p>模式 <code>Modbus RTU</code>；从站、功能码 03/04，在数据区按偏移解寄存器。Modbus 模式自带 CRC 校验。</p>
          <pre><code>01 03 04 00 64 00 C8 FA 33</code></pre>
        </article>
      </div>
      <div class="protocol-note">
        <strong>帧界：</strong>
        <span>整包、行界、帧头帧尾（HEX）三选一；HEX/JSON 可选 Modbus CRC16。JSON/HEX/Modbus 均支持最多 4 条曲线。</span>
      </div>
      <div class="protocol-note">
        <strong>测试：</strong>
        <span>曲线配置底部「解析样例」可离线验证；JSON 填文本，HEX/Modbus 填空格分隔十六进制。</span>
      </div>
    `,
  },
  mqtt: {
    title: "MQTT 曲线说明",
    html: `
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. JSON 单曲线</h3>
          <p>订阅主题收到的 payload 按 JSON 路径提取；常见物联网格式 <code>{"value":25.6}</code>。</p>
          <pre><code>{"value":25.6}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. JSON 多曲线</h3>
          <p>同一 JSON 内多条路径；嵌套与数组下标均支持，如 <code>sensors.0.temp</code>。</p>
          <pre><code>{"telemetry":{"temp":25.6,"pressure":1.23,"flow":18.4}}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. HEX 多曲线</h3>
          <p>payload 为原始字节（或 HEX 字符串）；按字节偏移解码，适用于二进制遥测。</p>
          <pre><code>00 64 00 C8</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>4. Modbus RTU 载荷</h3>
          <p>MQTT 消息体为完整或连续 Modbus RTU 字节流；自动切帧、校验 CRC、按数据区偏移解多条曲线。</p>
          <pre><code>01 03 04 00 64 00 C8 FA 33</code></pre>
        </article>
      </div>
      <div class="protocol-note">
        <strong>帧界与 CRC：</strong>
        <span>非 Modbus 模式可选行界/帧头帧尾/CRC；Modbus 模式强制 RTU CRC。多曲线时曲线名显示在图例与实时读数区。</span>
      </div>
      <div class="protocol-note">
        <strong>发布：</strong>
        <span>设备页配置发布主题、QoS、retain；监测面板只负责订阅解析与曲线，两者独立保存。</span>
      </div>
    `,
  },
};

export function getChartCurveHelp(deviceId) {
  return HELP_CONTENT[deviceId] ?? {
    title: "曲线说明",
    html: "<p>当前设备会自动从接收数据中提取数值并绘制曲线。</p>",
  };
}

export function listChartCurveHelpDeviceIds() {
  return Object.keys(HELP_CONTENT);
}
