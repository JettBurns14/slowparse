  // ### The DOM Builder
  //
  // The DOM builder is used to construct a DOM representation of the
  // HTML/CSS being parsed. Each node contains a `parseInfo` expando
  // property that contains information about the text extents of the
  // original source code that the DOM element maps to.
  //
  // The DOM builder is given a single document DOM object that will
  // be used to create all necessary DOM nodes.
module.exports = (function(){
  "use strict";

  var DocumentFragment = require("./DocumentFragment");

  function DOMBuilder(sourceCode, disallowActiveAttributes, scriptPreprocessor) {
    this.disallowActiveAttributes = disallowActiveAttributes;
    this.scriptPreprocessor = scriptPreprocessor;
    this.sourceCode = sourceCode;
    this.code = "";
    this.fragment = new DocumentFragment();
    this.currentNode = this.fragment.node;
    this.contexts = [];
    this.rules = [];
    this.last = 0;
    this.pushContext("html", 0);
  }

  DOMBuilder.prototype = {
    // This method pushes a new element onto the DOM builder's stack.
    // The element is appended to the currently active element and is
    // then made the new currently active element.
    pushElement: function(tagName, parseInfo, nameSpace) {
      var node = (nameSpace ? this.fragment.createElementNS(nameSpace, tagName)
                            : this.fragment.createElement(tagName));
      node.parseInfo = parseInfo;
      this.currentNode.appendChild(node);
      this.currentNode = node;
    },
    // This method pops the current element off the DOM builder's stack,
    // making its parent element the currently active element.
    popElement: function() {
      this.currentNode = this.currentNode.parentNode;
    },
    // record the cursor position for a context change (text/html/css/script)
    pushContext: function(context, position) {
      this.contexts.push({
        context: context,
        position: position
      });
    },
    // This method appends an HTML comment node to the currently active
    // element.
    comment: function(data, parseInfo) {
      var comment = this.fragment.createComment('');
      comment.nodeValue = data;
      comment.parseInfo = parseInfo;
      this.currentNode.appendChild(comment);
    },
    // This method appends an attribute to the currently active element.
    attribute: function(name, value, parseInfo) {
      var attrNode = this.fragment.createAttribute(name);
      attrNode.parseInfo = parseInfo;
      if (this.disallowActiveAttributes && name.substring(0,2).toLowerCase() === "on") {
        attrNode.nodeValue = "";
      } else {
        attrNode.nodeValue = value;
      }
      try {
        // IE will error when trying to set input type="text"
        // See http://reference.sitepoint.com/javascript/Element/setAttributeNode
        this.currentNode.attributes.setNamedItem(attrNode);
      } catch (e) {
      }
    },
    // This method appends a text node to the currently active element.
    text: function(text, parseInfo) {
        if (this.currentNode && this.currentNode.attributes) {
          var type = this.currentNode.attributes.type || "";
          if (type.toLowerCase) {
              type = type.toLowerCase();
          } else if (type.nodeValue) { // button type="submit"
              type = type.nodeValue;
          }
          if (this.currentNode.nodeName.toLowerCase() === "script" && (!type || type === "text/javascript")) {
            this.javascript(text, parseInfo);
            // Don't actually add javascript to the DOM we're building
            // because it will execute and we don't want that.
            return;
          } else if (this.currentNode.nodeName.toLowerCase() === "style") {
            this.rules.push.apply(this.rules, parseInfo.rules);
          }
        }
        var textNode = this.fragment.createTextNode(text);
        textNode.parseInfo = parseInfo;
        this.currentNode.appendChild(textNode);
    },
    javascript: function(text, parseInfo) {
      try {
        text = this.scriptPreprocessor(text);
      } catch(err) {
        // This is meant to handle esprima errors
        if (err.index && err.description && err.message) {
          var cursor = this.currentNode.parseInfo.openTag.end + err.index;
          throw {parseInfo: {type: "JAVASCRIPT_ERROR", message: err.description, cursor: cursor} };
        } else {
          throw err;
        }
      }
      this.code += this.sourceCode.slice(this.last, parseInfo.start);
      this.code += text;
      this.last = parseInfo.end;
    },
    close: function() {
      this.code += this.sourceCode.slice(this.last);
    }
  };

  return DOMBuilder;

}());
