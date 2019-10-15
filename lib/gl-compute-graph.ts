
import {Session} from './session';
import {Model} from './model';
import {Tensor, sizeof} from './tensor';
import {Graph} from './graph';
import {resolveOperator} from './opset';
import {WEBGL_OP_RESOLVE_RULES} from './backends/webgl/op-resolve-rules';
import {WebGLOperator, ProgramInfo, VariableInfo} from './backends/webgl/types';
import { WebGLInferenceHandler } from './backends/webgl/inference-handler';
import {GlslPreprocessor} from './backends/webgl/glsl-preprocessor';
import {WebGLContext} from './backends/webgl/webgl-context';
import {getVertexShaderSource} from './backends/webgl/glsl-source';

class KernelOp {
    constructor(public op: string, public node: Graph.Node) {}
}

function escapeCLiteral(s:string):string {
    return s.replace(/(["\\\r\n])/, (match, g) => `\\u${g.charCodeAt(0).toString()}`);
}

export class GLComputeGraph {

    session:Session;
    inferenceHandler:WebGLInferenceHandler;
    ops:KernelOp[];
    starter:KernelOp[];
    model:Model;
    nodes:ReadonlyArray<Graph.Node>;
    values:ReadonlyArray<Graph.Value>;
    vertSource:string;
    namespacePrefix:string;
    byteOffsets:number[];

    constructor(s:Session, namespacePrefix:string) {
        this.namespacePrefix = namespacePrefix;
        this.session = s;
        this.ops = [];
        this.starter = [];
        this.inferenceHandler = new WebGLInferenceHandler();
        this.model = this.session.getModel();
        this.nodes = this.model.graph.getNodes();
        this.values = this.model.graph.getValues();
        this.vertSource = getVertexShaderSource(2);
        this.byteOffsets = [];
        this.init();
    }

    valueToTensor(v: Graph.Value):Tensor {
        if (v.tensor) {
            return v.tensor;
        } else {
            throw new Error('TODO: don\'t know tensor shape');
        }
    }

    compileOp(op:WebGLOperator, inputs:Tensor[]):ProgramInfo {
        return op.createProgramInfo(this.inferenceHandler, inputs);
    }
  
    resolve(node: Graph.Node): WebGLOperator {
        const op = resolveOperator(node, this.model.opsets, WEBGL_OP_RESOLVE_RULES);
        op.initialize(node.attributes);
        return op as unknown as WebGLOperator;
    }

    toKernel(node: Graph.Node):KernelOp {
        const op = this.resolve(node);
        const inputValues = node.inputs.map(idx => this.values[idx]);
        const tensors = inputValues.map(this.valueToTensor);
        const prog = this.compileOp(op, tensors);
        const pp = new GlslPreprocessor(new WebGLContext(2), prog);
        return new KernelOp(pp.preprocess(), node);
    }

    init() {
        this.ops = this.nodes.map(this.toKernel);
        let off = 0;
        for (const v of this.values) {
            const t = v.tensor;
            if (t) {
                const vlen = sizeof(t.type) * t.size;
                this.byteOffsets.push(off);
                off += vlen;
            } else {
                this.byteOffsets.push(off);
            }
        }
    }

    tensorCDataType(t:Tensor):string {
        switch(t.type) {
            case 'bool':
                return 'char';
            case 'float32':
                return 'float';
            case 'float64':
                return 'double';
            case 'string':
            case 'int8':
                return 'char';
            case 'uint8':
                return 'unsigned char';
            case 'int16':
                return 'short';
            case 'uint16':
                return 'unsigned short';
            case 'int32':
                return 'long';
            case 'uint32':
                return 'unsigned long';
            default:
                throw new Error(`unknown data type: ${t.type}`);
        }
    }

    opShaderSourceVariableName(op:KernelOp):string {
        return `${this.namespacePrefix}_fragSource_${name}`;
    }
    opShaderProgramVariableName(op:KernelOp):string {
        return `${this.namespacePrefix}_frag_${name}`;
    }

    preambleCode():string {
        return `
            const char *${this.namespacePrefix}_vertSource = "${escapeCLiteral(this.vertSource)}";
            ${this.ops.map(
                op => `const char *${this.opShaderSourceVariableName(op)} = "${escapeCLiteral(op.op)}";`).join('\n')}
        `;
    }

    ctxStructCode():string {
        return `
            typedef struct ${this.namespacePrefix}_Context {
                Gluint vertShader;
                GLuint program;
                ${this.ops.map(op => 
                     `GLuint fragShader_${op.node.name};`
                ).join('\n')}
                ${this.values.map((v, i) => 
                    v.tensor ? `${this.tensorCDataType(v.tensor)} *value_${i};` : '').join('\n')}
            } ${this.namespacePrefix}_Context;
        `;
    }

    headerCode():string {
        return `
        #include <gl.h>
        ${this.ctxStructCode()}
        `;
    }

    initCodeCheckError(name:string):string {
        return `
        isCompiled = 0;
        glGetShaderiv(${name}, GL_COMPILE_STATUS, &isCompiled);
        if (isCompiled == GL_FALSE) {
            GLint maxLength = 0;
            glGetShaderiv(${name}, GL_INFO_LOG_LENGTH, &maxLength);
            char *log = malloc(maxLength);
            glGetShaderInfoLog(${name}, maxLength, &maxLength, log);
            ${this.namespacePrefix}_logError(log);
            return -1;
        }`;
    }

    dataTextureCode(valueIdx:number, inp:string, outp:string):string {
        const value = this.values[valueIdx];
        if (value.tensor) {
            const offset = this.byteOffsets[valueIdx];
            const length = this.byteOffsets[valueIdx+1] - offset;
            const dtype = this.tensorCDataType(value.tensor);
            return `
                ${dtype} *value_blob_${valueIdx} = (${dtype} *) &${inp}[${offset}];
                ${outp} = glCreateTexture();
                glBindTexture(GL_TEXTURE_2D, ${outp});
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
                glTexImage2D(GL_TEXTURE_2D, 0, ${this.internalFormat(value)}, )
            `;
        } else {
            return '';
        }
    }

    initCode():string {
        return `
        int ${this.namespacePrefix}_init(${this.namespacePrefix}_Context *ctx, char *params) {
            const GLint _length = 1;
            GLint isCompiled = 0;

            ctx->program = glCreateProgram();

            ctx->vertShader = glCreateShader(GL_VERTEX_SHADER);
            _length = strlen(${this.namespacePrefix}_vertSource);
            glShaderSource(ctx->vertexShader, 1,
                &${this.namespacePrefix}_vertSource, &_length);

            ${this.initCodeCheckError('ctx->vertexShader')}

            ${this.ops.map(op => 
                `
                ctx->fragShader_${op.node.name} = glCreateShader(GL_FRAGMENT_SHADER);
                _length = strlen(${this.opShaderProgramVariableName(op)});
                glShaderSource(ctx->fragShader_${op.node.name}, 1,
                    &${this.opShaderProgramVariableName(op)}, &_length);
                glCompileShader(ctx->fragShader_${op.node.name});
                ${this.initCodeCheckError(`ctx->fragShader_${op.node.name}`)}

                `
            ).join('\n')}

            glAttachShader(ctx->program, ctx->vertShader);
            ${this.ops.map(op =>`glAttachShader(ctx->program, ctx->fragShader_${op.node.name});`).join('\n')}

            return 0;
        }
        `;
    }

}