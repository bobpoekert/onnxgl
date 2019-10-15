// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as DataEncoders from './texture-data-encoder';
import {DataEncoder, Encoder} from './texture-data-encoder';

export class WebGLTexture {

  width:number;
  height:number;
  data:Encoder.DataArrayType;

  constructor(width:number, height:number, data:Encoder.DataArrayType) {
    this.width = width;
    this.height = height;
    this.data = data;
  }

}

export class WebGLProgram {
  public vertexShader:string;
  public fragShader:string;

  constructor(v:string, f:string) {
    this.vertexShader = v;
    this.fragShader = f;
  }
}

type WebGLShader = string;
type WebGLFramebuffer = null;

/**
 * Abstraction and wrapper around WebGLRenderingContext and its operations
 */
export class WebGLContext {
  //gl: WebGLRenderingContext;
  version: 1|2;

  private currentTexture:WebGLTexture|null;

  // WebGL flags and vital parameters
 // private isFloatTextureAttachableToFrameBuffer: boolean;
  isFloat32DownloadSupported: boolean;
  isRenderFloat32Supported: boolean;
  isBlendSupported: boolean;
  maxTextureSize: number;
  // private maxCombinedTextureImageUnits: number;
  //private maxTextureImageUnits: number;
  // private maxCubeMapTextureSize: number;
  // private shadingLanguageVersion: string;
  // private webglVendor: string;
  // private webglVersion: string;

  // WebGL2 flags and vital parameters
  // private max3DTextureSize: number;
  // private maxArrayTextureLayers: number;
  // private maxColorAttachments: number;
  // private maxDrawBuffers: number;

  // WebGL extensions
  textureFloatExtension: OES_texture_float|null;
  textureHalfFloatExtension: OES_texture_half_float|null;

  // WebGL2 extensions
  colorBufferFloatExtension: {}|null;

  //private disposed: boolean;
  //private frameBufferBound = false;

  constructor(version: 1|2) {
    //this.gl = gl;
    this.version = version;

    this.currentTexture = null;

    this.getExtensions();
    //this.vertexbuffer = this.createVertexbuffer();
    //this.framebuffer = this.createFramebuffer();
    this.queryVitalParameters();
  }

  allocateTexture(width: number, height: number, encoder: DataEncoder, data?: Encoder.DataArrayType): WebGLTexture {
    /*const gl = this.gl;
    // create the texture
    const texture = gl.createTexture();
    // bind the texture so the following methods effect this texture.
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);*/
    const buffer = data ? encoder.encode(data, width * height) : null;
    /*
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,  // Level of detail.
        encoder.internalFormat, width, height,
        0,  // Always 0 in OpenGL ES.
        encoder.format, encoder.textureType, buffer);
    this.checkError();
    return texture as WebGLTexture;*/
    if (buffer !== null) {
      return new WebGLTexture(width, height, buffer);
    } else {
      throw new Error('null texture');
    }

  }
  updateTexture(
      texture: WebGLTexture, width: number, height: number, encoder: DataEncoder, data: Encoder.DataArrayType): void {
    /*const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const buffer = encoder.encode(data, width * height);
    gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,  // level
        0,  // xoffset
        0,  // yoffset
        width, height, encoder.format, encoder.textureType, buffer);
    this.checkError();*/
    this.currentTexture = texture;
  }
  attachFramebuffer(texture: WebGLTexture, width: number, height: number): void {
    /*const gl = this.gl;
    // Make it the target for framebuffer operations - including rendering.
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture,
        0);  // 0, we aren't using MIPMAPs
    this.checkError();
    gl.viewport(0, 0, width, height);
    gl.scissor(0, 0, width, height);*/
  }
  readTexture(
      texture: WebGLTexture, width: number, height: number, dataSize: number, dataType: Encoder.DataType,
      channels: number): Encoder.DataArrayType {
    /*const gl = this.gl;
    if (!channels) {
      channels = 1;
    }
    if (!this.frameBufferBound) {
      this.attachFramebuffer(texture, width, height);
    }
    const encoder = this.getEncoder(dataType, channels);
    const buffer = encoder.allocate(width * height);
    // bind texture to framebuffer
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture,
        0);  // 0, we aren't using MIPMAPs
    // TODO: Check if framebuffer is ready
    gl.readPixels(0, 0, width, height, gl.RGBA, encoder.textureType, buffer);
    this.checkError();
    // unbind FB
    return encoder.decode(buffer, dataSize);*/
    return texture.data;
  }
  isFramebufferReady(): boolean {
    // TODO: Implement logic to check if the framebuffer is ready
    return true;
  }
  getActiveTexture(): string {
    /*const gl = this.gl;
    const n = gl.getParameter(this.gl.ACTIVE_TEXTURE);
    return `TEXTURE${(n - gl.TEXTURE0)}`;
    */
   return 'TEXTURE0';
  }
  getTextureBinding(): WebGLTexture {
    //return this.gl.getParameter(this.gl.TEXTURE_BINDING_2D);
    if (this.currentTexture === null) {
      throw new Error('no texture');
    }
    return this.currentTexture;
  }
  getFramebufferBinding(): WebGLFramebuffer {
    //return this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING);
    return null;
  }
  setVertexAttributes(positionHandle: number, textureCoordHandle: number): void {
    /*const gl = this.gl;
    gl.vertexAttribPointer(positionHandle, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(positionHandle);
    if (textureCoordHandle !== -1) {
      gl.vertexAttribPointer(textureCoordHandle, 2, gl.FLOAT, false, 20, 12);
      gl.enableVertexAttribArray(textureCoordHandle);
    }
    this.checkError();*/
  }
  createProgram(
      vertexShader: WebGLShader,
      fragShader: WebGLShader,
      ): WebGLProgram {
    /*const gl = this.gl;
    const program = gl.createProgram()!;

    // the program consists of our shaders
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    return program;*/
    return new WebGLProgram(vertexShader, fragShader);
  }
  compileShader(shaderSource: string, shaderType: number): WebGLShader {
    return shaderSource;
  }
  deleteShader(shader: WebGLShader): void {
  }
  bindTextureToUniform(texture: WebGLTexture, position: number, uniformHandle: WebGLUniformLocation): void {
  }
  draw(): void {
  }
  checkError(): void {
  }
  deleteTexture(texture: WebGLTexture): void {
  }
  deleteProgram(program: WebGLProgram): void {
  }
  getEncoder(dataType: Encoder.DataType, channels: number, usage: Encoder.Usage = Encoder.Usage.Default): DataEncoder {
    if (this.version === 2) {
      return new DataEncoders.RedFloat32DataEncoder(channels);
    }

    switch (dataType) {
      case 'float':
          return new DataEncoders.RGBAFloatDataEncoder(channels);
      case 'int':
        throw new Error('not implemented');
      case 'byte':
        return new DataEncoders.Uint8DataEncoder(channels);
      default:
        throw new Error(`Invalid dataType: ${dataType}`);
    }
  }
  clearActiveTextures(): void {
    this.currentTexture = null;
  }
  dispose(): void {
  }

  /*private createDefaultGeometry(): Float32Array {
    // Sets of x,y,z(=0),s,t coordinates.
    return new Float32Array([
      -1.0, 1.0,  0.0, 0.0, 1.0,  // upper left
      -1.0, -1.0, 0.0, 0.0, 0.0,  // lower left
      1.0,  1.0,  0.0, 1.0, 1.0,  // upper right
      1.0,  -1.0, 0.0, 1.0, 0.0
    ]);  // lower right
  }*/
  private queryVitalParameters(): void {
  }
  private getExtensions(): void {
    return;
    /*
    if (this.version === 2) {
      this.colorBufferFloatExtension = this.gl.getExtension('EXT_color_buffer_float');
    } else {
      this.textureFloatExtension = this.gl.getExtension('OES_texture_float');
      this.textureHalfFloatExtension = this.gl.getExtension('OES_texture_half_float');
    }*/
  }

}
