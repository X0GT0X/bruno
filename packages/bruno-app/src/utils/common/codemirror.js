import get from 'lodash/get';

let CodeMirror;
const SERVER_RENDERED = typeof window === 'undefined' || global['PREVENT_CODEMIRROR_RENDER'] === true;
const urlRexExp = /^((?:(?:aaas?|about|acap|adiumxtra|af[ps]|aim|apt|attachment|aw|beshare|bitcoin|bolo|callto|cap|chrome(?:-extension)?|cid|coap|com-eventbrite-attendee|content|crid|cvs|data|dav|dict|dlna-(?:playcontainer|playsingle)|dns|doi|dtn|dvb|ed2k|facetime|feed|file|finger|fish|ftp|geo|gg|git|gizmoproject|go|gopher|gtalk|h323|hcp|https?|iax|icap|icon|im|imap|info|ipn|ipp|irc[6s]?|iris(?:\.beep|\.lwz|\.xpc|\.xpcs)?|itms|jar|javascript|jms|keyparc|lastfm|ldaps?|magnet|mailto|maps|market|message|mid|mms|ms-help|msnim|msrps?|mtqp|mumble|mupdate|mvn|news|nfs|nih?|nntp|notes|oid|opaquelocktoken|palm|paparazzi|platform|pop|pres|proxy|psyc|query|res(?:ource)?|rmi|rsync|rtmp|rtsp|secondlife|service|session|sftp|sgn|shttp|sieve|sips?|skype|sm[bs]|snmp|soap\.beeps?|soldat|spotify|ssh|steam|svn|tag|teamspeak|tel(?:net)?|tftp|things|thismessage|tip|tn3270|tv|udp|unreal|urn|ut2004|vemmi|ventrilo|view-source|webcal|wss?|wtai|wyciwyg|xcon(?:-userid)?|xfire|xmlrpc\.beeps?|xmpp|xri|ymsgr|z39\.50[rs]?):(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\([^\s()<>]*\))+(?:\([^\s()<>]*\)|[^\s`*!()\[\]{};:'".,<>?«»“”‘’]))/i;

if (!SERVER_RENDERED) {
  CodeMirror = require('codemirror');
}

const pathFoundInVariables = (path, obj) => {
  const value = get(obj, path);
  return value !== undefined;
};

/**
 * Changes the render behaviour for a given CodeMirror editor.
 * Replaces all **rendered** characters, not the actual value, with the provided character.
 */
export class MaskedEditor {
  /**
   * @param {import('codemirror').Editor} editor CodeMirror editor instance
   * @param {string} maskChar Target character being applied to all content
   */
  constructor(editor, maskChar) {
    this.editor = editor;
    this.maskChar = maskChar;
    this.enabled = false;
  }

  /**
   * Set and apply new masking character
   */
  enable = () => {
    this.enabled = true;
    this.editor.setValue(this.editor.getValue());
    this.editor.on('inputRead', this.maskContent);
    this.update();
  };

  /** Disables masking of the editor field. */
  disable = () => {
    this.enabled = false;
    this.editor.off('inputRead', this.maskContent);
    this.editor.setValue(this.editor.getValue());
  };

  /** Updates the rendered content if enabled. */
  update = () => {
    if (this.enabled) this.maskContent();
  };

  /** Replaces all rendered characters, with the provided character. */
  maskContent = () => {
    const content = this.editor.getValue();
    const lineCount = this.editor.lineCount();

    if (lineCount === 0) return;
    this.editor.operation(() => {
      // Clear previous masked text
      this.editor.getAllMarks().forEach((mark) => mark.clear());
      // Apply new masked text

      if (content.length <= 500) {
        for (let i = 0; i < content.length; i++) {
          if (content[i] !== '\n') {
            const maskedNode = document.createTextNode(this.maskChar);
            this.editor.markText(
              { line: this.editor.posFromIndex(i).line, ch: this.editor.posFromIndex(i).ch },
              { line: this.editor.posFromIndex(i + 1).line, ch: this.editor.posFromIndex(i + 1).ch },
              { replacedWith: maskedNode, handleMouseEvents: true }
            );
          }
        }
      } else {
        for (let line = 0; line < lineCount; line++) {
          const lineLength = this.editor.getLine(line).length;
          const maskedNode = document.createTextNode('*'.repeat(lineLength)); 
          this.editor.markText(
            { line, ch: 0 },
            { line, ch: lineLength },
            { replacedWith: maskedNode, handleMouseEvents: false } 
          );
        }
      }
    });
  };
}

export const defineCodeMirrorBrunoVariablesMode = (_variables, mode, highlightPathParams) => {
  CodeMirror.defineMode('brunovariables', function (config, parserConfig) {
    const { pathParams = {}, ...variables } = _variables || {};
    const variablesOverlay = {
      token: function (stream) {
        if (stream.match('{{', true)) {
          let ch;
          let word = '';
          while ((ch = stream.next()) != null) {
            if (ch === '}' && stream.peek() === '}') {
              stream.eat('}');
              const found = pathFoundInVariables(word, variables);
              const status = found ? 'valid' : 'invalid';
              const randomClass = `random-${(Math.random() + 1).toString(36).substring(9)}`;
              return `variable-${status} ${randomClass}`;
            }
            word += ch;
          }
        }
        stream.skipTo('{{') || stream.skipToEnd();
        return null;
      }
    };

    const urlHighlightOverlay = {
      token: function (stream, state) {
        if (
          stream.match(urlRexExp) &&
          stream.string.slice(stream.start - 2, stream.start) !== "](" &&
          (stream.start === 0 || /\W/.test(stream.string.charAt(stream.start - 1)))
        ) {
          return "link";
        }

        stream.next();

        return null;
      }
    };

    const urlPathParamsOverlay = {
      token: function (stream) {
        if (stream.match('/:', true)) {
          let ch;
          let word = '';
          while ((ch = stream.next()) != null) {
            if (ch === '/' || ch === '?' || ch === '&' || ch === '=') {
              stream.backUp(1);
              const found = pathFoundInVariables(word, pathParams);
              const status = found ? 'valid' : 'invalid';
              const randomClass = `random-${(Math.random() + 1).toString(36).substring(9)}`;
              return `variable-${status} ${randomClass}`;
            }
            word += ch;
          }

          // If we've consumed all characters and the word is not empty, it might be a path parameter at the end of the URL.
          if (word) {
            const found = pathFoundInVariables(word, pathParams);
            const status = found ? 'valid' : 'invalid';
            const randomClass = `random-${(Math.random() + 1).toString(36).substring(9)}`;
            return `variable-${status} ${randomClass}`;
          }
        }
        stream.skipTo('/:') || stream.skipToEnd();
        return null;
      }
    };

    let baseMode = CodeMirror.overlayMode(CodeMirror.getMode(config, parserConfig.backdrop || mode), urlHighlightOverlay);
    baseMode = CodeMirror.overlayMode(baseMode, variablesOverlay);

    if (highlightPathParams) {
      return CodeMirror.overlayMode(baseMode, urlPathParamsOverlay);
    } else {
      return baseMode;
    }
  });
};

export const getCodeMirrorModeBasedOnContentType = (contentType, body) => {
  if (typeof body === 'object') {
    return 'application/ld+json';
  }
  if (!contentType || typeof contentType !== 'string') {
    return 'application/text';
  }

  if (contentType.includes('json')) {
    return 'application/ld+json';
  } else if (contentType.includes('xml')) {
    return 'application/xml';
  } else if (contentType.includes('html')) {
    return 'application/html';
  } else if (contentType.includes('text')) {
    return 'application/text';
  } else if (contentType.includes('application/edn')) {
    return 'application/xml';
  } else if (contentType.includes('yaml')) {
    return 'application/yaml';
  } else if (contentType.includes('image')) {
    return 'application/image';
  } else {
    return 'application/text';
  }
};
