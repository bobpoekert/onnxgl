// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import {Environment} from './env';
import {InferenceSessionConstructor} from './inference-session';
import {TensorConstructor} from './tensor';

//#region Backends

export declare namespace Backend {
  interface BackendOptions {
    /**
     * set or get a flag specifying whether to force disable the backend
     */
    disabled?: boolean;
  }
  /**
   * set options for the WebGL backend
   */
  interface WebGLOptions extends BackendOptions {
    /**
     * set or get the WebGL Context ID (webgl or webgl2)
     */
    contextId?: 'webgl'|'webgl2';
    /**
     * set or get the maximum batch size for matmul. 0 means to disable batching.
     */
    matmulMaxBatchSize?: number;
    /**
     * set or get the texture cache mode
     */
    textureCacheMode?: 'initializerOnly'|'full';
  }

  /**
   * represent all backend settings
   */
  interface Settings {
    /**
     * set one or more string(s) as hint for onnx session to resolve the corresponding backend
     */
    hint?: string|ReadonlyArray<string>;
  }

  /**
   * represent all available backends
   */
  interface AvailableBackends {
    webgl: WebGLOptions;

    /**
     * set options for the specific backend
     */
    [name: string]: Backend.BackendOptions;
  }
}

export type Backend = Backend.Settings&Backend.AvailableBackends;

//#endregion Backends

export interface Onnx {
  /**
   * represent a tensor with specified dimensions and data type.
   */
  readonly Tensor: TensorConstructor;
  /**
   * represent a runtime instance of an ONNX model
   */
  readonly InferenceSession: InferenceSessionConstructor;
  /**
   * represent all available backends and settings of them
   */
  readonly backend: Backend;
  /**
   * represent runtime environment settings and status of ONNX.js
   */
  readonly ENV: Environment;
}
