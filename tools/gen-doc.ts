// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fs from 'fs';
import * as https from 'https';
import {EOL} from 'os';
import * as path from 'path';
import * as readline from 'readline';

import {Attribute} from '../lib/attribute';
import {WEBGL_OP_RESOLVE_RULES} from '../lib/backends/webgl/op-resolve-rules';
import {Operator} from '../lib/operators';
import {OpSet, resolveOperator} from '../lib/opset';

// tslint:disable: non-literal-fs-path

https.get('https://raw.githubusercontent.com/onnx/onnx/v1.5.0/onnx/defs/operator_sets.h', res => {
  const rl = readline.createInterface({input: res});

  const matcher = /class ONNX_OPERATOR_SET_SCHEMA_CLASS_NAME\(\s*(\w+),\s*(\d+),\s*(\w+)\)/;

  const ops = new Map<string, Map<string, number[]>>();

  const webglCheckOnlyRules =
      WEBGL_OP_RESOLVE_RULES.map(rule => [rule[0], rule[1], rule[2], dummyOpConstructor] as OpSet.ResolveRule);

  rl.on('line', input => {
    const matches = matcher.exec(input);
    if (matches) {
      const opset = matches[1];
      const version = Number.parseInt(matches[2], 10);
      const opType = matches[3];

      let currentSet = ops.get(opset);
      if (currentSet === undefined) {
        currentSet = new Map<string, number[]>();
        ops.set(opset, currentSet);
      }

      let currentOp = currentSet.get(opType);
      if (currentOp === undefined) {
        currentOp = [];
        currentSet.set(opType, currentOp);
      }

      currentOp.push(version);
    }
  });

  rl.on('close', () => {
    const opsets = Array.from(ops.keys());
    assert.ok(opsets.length === 1 && opsets[0] === 'Onnx');

    const onnxOpset = ops.get(opsets[0])!;
    const opTypes = Array.from(onnxOpset.keys()).sort();

    const doc = fs.createWriteStream(path.join(__dirname, '../docs/operators.md'));
    doc.write(`## Operators Support Table${EOL}${EOL}`);
    doc.write(`The following table shows [ai.onnx](https://github.com/onnx/onnx/blob/master/docs/Operators.md)\
  operators from which onnx opset version are currently supported by onnxjs. For example, \`4-6, 8+\` means\
  ONNX.js currently support opset version 4 to 6, 8 and above.${EOL}${EOL}`);
    doc.write(`See [Compatibility](../README.md#Compatibility) for a list of the supported platforms.${EOL}${EOL}`);
    doc.write(`*This file is automatically generated from the\
  def files via [this script](/tools/gen-doc.ts).\
  Do not modify directly.*${EOL}${EOL}`);
    doc.write(`| Operator | Cpu Backend | Wasm Backend | WebGl Backend |${EOL}`);
    doc.write(`|:--------:|:-----------:|:------------:|:-------------:|${EOL}`);

    const VERSION_MAX = 10;
    for (const type of opTypes) {
      const versions = onnxOpset.get(type)!.sort((a, b) => a - b);

      const cpu: string[] = [], wasm: string[] = [], webgl: string[] = [];
      for (let i = 0; i < versions.length; i++) {
        const last = i === versions.length - 1;
        const versionRange: [number, number] = [versions[i], last ? VERSION_MAX : versions[i + 1] - 1];

        cpu.push(formatDesc(type, versionRange, checkSupport(type, versionRange, cpuCheckOnlyRules), last));
        wasm.push(formatDesc(type, versionRange, checkSupport(type, versionRange, wasmCheckOnlyRules), last));
        webgl.push(formatDesc(type, versionRange, checkSupport(type, versionRange, webglCheckOnlyRules), last));
      }

      doc.write(`| [${type}](https://github.com/onnx/onnx/blob/master/docs/Operators.md#${type}) | ${
          cpu.filter(d => d.length > 0).join(', ')} | ${wasm.filter(d => d.length > 0).join(', ')} | ${
          webgl.filter(d => d.length > 0).join(', ')} |${EOL}`);
    }
    doc.end();
  });
});

function checkSupport(type: string, range: [number, number], rules: ReadonlyArray<OpSet.ResolveRule>) {
  const node = {name: '', opType: type, inputs: [], outputs: [], attributes: new Attribute(undefined)};
  for (let i = range[0]; i <= range[1]; i++) {
    try {
      resolveOperator(node, [{domain: '', version: i}], rules);
    } catch (_e) {
      return false;
    }
  }
  return true;
}

function dummyOpConstructor(): Operator {
  // tslint:disable-next-line:no-any
  return {} as any as Operator;
}

function formatDesc(opType: string, range: [number, number], support: boolean, last: boolean) {
  let versionDesc = '';
  if (support) {
    versionDesc = last ? `${range[0]}+` : range[0] === range[1] ? `${range[0]}` : `${range[0]}-${range[1]}`;
  }
  // if (!last) {
  //   versionDesc =
  //   `[${versionDesc}](https://github.com/onnx/onnx/blob/master/docs/Changelog.md#${opType}-${range[0]})`;
  // }
  return versionDesc;
}
