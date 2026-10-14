import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptureTimeline } from '../../pages/devices/microscope-power/timeline.js';
import { aggregateTimeBuckets, WavePlot } from '../../pages/devices/microscope-power/plot.js';
import { FRAME_FLAGS } from '../../pages/devices/microscope-power/protocol.js';

const frame = (t0Us, flags = 0, sampleRate = 100000) => ({t0Us, flags, sampleRate, count:256});

test('range settling gap remains in real timestamps and splits plotted segments', () => {
  const timeline = new CaptureTimeline(1024);
  timeline.append(frame(0), 0);
  timeline.append(frame(17920, 1 << 5), 256);
  assert.equal(timeline.timeAt(256), 0.01792);
  assert.equal(timeline.timeAt(255), 0.00255);
  assert.equal(timeline.lowerBound(0.01, 0, 512), 256);
  assert.deepEqual(timeline.segments(100, 400), [
    {startOffset:0,endOffset:156},{startOffset:156,endOffset:400},
  ]);
});

test('device timestamp rollover is extended without changing sample spacing', () => {
  const timeline = new CaptureTimeline(1024);
  timeline.append(frame(0xfffffc00), 0);
  timeline.append(frame((0xfffffc00 + 2560) >>> 0), 256);
  assert.equal(timeline.timeAt(256), 0.00256);
  assert.deepEqual(timeline.segments(0, 512), [{startOffset:0,endOffset:512}]);
});

test('retained frame metadata wraps and reset begins a fresh clock', () => {
  const timeline = new CaptureTimeline(512);
  for(let i=0;i<20;i++) timeline.append(frame(i*2560),i*256);
  assert.equal(timeline.frameAt(0), null);
  assert.equal(timeline.timeAt(19*256), 19*0.00256);
  timeline.reset();
  timeline.append(frame(987654),0);
  assert.equal(timeline.timeAt(0),0);
});

test('explicit discontinuity splits equal-rate data and invalid backwards time is rejected', () => {
  const timeline = new CaptureTimeline(1024);
  timeline.append(frame(10000),0);
  timeline.append(frame(12560,1 << 5),256);
  assert.equal(timeline.segments(0,512).length,2);
  assert.throws(()=>timeline.append(frame(12000),512),/时间戳/);
});

test('consecutive slower frames use measured spacing instead of creating a gap at every frame', () => {
  const timeline = new CaptureTimeline(1024);
  timeline.append({...frame(10000), seq:0},0);
  timeline.append({...frame(13680), seq:1},256);
  timeline.append({...frame(17362), seq:2},512);
  assert.deepEqual(timeline.segments(0,768), [{startOffset:0,endOffset:768}]);
  assert.equal(timeline.timeAt(256),0.00368);
  assert.ok(Math.abs(timeline.timeAt(255) - 255 * 0.00368 / 256) < 1e-12);
  assert.ok(Math.abs(timeline.timeAfter(511) - timeline.timeAt(512)) < 1e-12);
  for(let i=1;i<768;i++) assert.ok(timeline.timeAt(i)>timeline.timeAt(i-1));
});

test('legacy timing-only flags can stay continuous while real loss and settling keep their gaps', () => {
  const legacy = { legacyTimingOverruns:true };
  const timeline = new CaptureTimeline(1024);
  timeline.append({...frame(0), seq:0},0,legacy);
  timeline.append({...frame(3680,FRAME_FLAGS.gapBefore), seq:1},256,legacy);
  assert.equal(timeline.segments(0,512).length,1);
  assert.ok(Math.abs(timeline.timeAfter(255)-timeline.timeAt(256))<1e-12);

  for(const [label, next] of [
    ['lost frame', {...frame(3680,FRAME_FLAGS.gapBefore), seq:2}],
    ['changed range', {...frame(3680,FRAME_FLAGS.gapBefore|FRAME_FLAGS.range10Ohm), seq:1}],
    ['long settling', {...frame(17920,FRAME_FLAGS.gapBefore), seq:1}],
    ['new firmware explicit loss', {...frame(3680,FRAME_FLAGS.gapBefore|FRAME_FLAGS.timingOverrun), seq:1}],
  ]) {
    timeline.reset();
    timeline.append({...frame(0), seq:0},0,legacy);
    timeline.append(next,256,legacy);
    assert.equal(timeline.segments(0,512).length,2,label);
    assert.equal(timeline.timeAt(255),0.00255,label);
  }
});

test('a sequence gap splits the curve even when timestamps appear adjacent', () => {
  const timeline = new CaptureTimeline(1024);
  timeline.append({...frame(0),seq:65535},0);
  timeline.append({...frame(2560),seq:0},256);
  timeline.append({...frame(5120),seq:2},512);
  assert.deepEqual(timeline.segments(0,768),[
    {startOffset:0,endOffset:512},{startOffset:512,endOffset:768},
  ]);
});

function timeSource(timeline) {
  return {
    visibleSamples:512, timeStart:0, timeEnd:0.02048,
    timeSegments:timeline.segments(0,512),
    readVisibleTime:i=>timeline.timeAt(i),
    timeToOffset:t=>timeline.lowerBound(t,0,512),
    readVisibleAggregate:(start,end)=>({min:start,max:end-1,sum:(start+end-1)*(end-start)/2,count:end-start}),
  };
}

test('pixel buckets preserve a time gap and count each retained point exactly once', () => {
  const timeline = new CaptureTimeline(1024);
  timeline.append(frame(0),0);
  timeline.append(frame(17920,1 << 5),256);
  const buckets = aggregateTimeBuckets(timeSource(timeline),256);
  assert.equal(buckets.reduce((sum,b)=>sum+b.count,0),512);
  assert.ok(buckets.every(b=>b.x<32 || b.x>=224));
  assert.equal(new Set(buckets.map(b=>b.segment)).size,2);
});

test('plot hit testing and cursor placement use timestamp coordinates', () => {
  const timeline = new CaptureTimeline(1024);
  timeline.append(frame(0),0);
  timeline.append(frame(17920,1 << 5),256);
  const plot = Object.create(WavePlot.prototype);
  plot.canvas={getBoundingClientRect:()=>({left:0})};
  plot.metrics={source:timeSource(timeline),visibleSamples:512,plotWidth:256,padLeft:0,dpr:1};
  assert.ok(Math.abs(plot.sampleOffsetToClientX(256)-224)<1e-9);
  assert.equal(plot.clientXToSampleOffset(128),256);
});
