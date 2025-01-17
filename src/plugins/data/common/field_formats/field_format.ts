/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { transform, size, cloneDeep, get, defaults } from 'lodash';
import { createCustomFieldFormat } from './converters/custom';
import {
  FieldFormatsGetConfigFn,
  FieldFormatsContentType,
  FieldFormatInstanceType,
  FieldFormatConvert,
  FieldFormatConvertFunction,
  HtmlContextTypeOptions,
  TextContextTypeOptions,
  IFieldFormatMetaParams,
} from './types';
import { htmlContentTypeSetup, textContentTypeSetup, TEXT_CONTEXT_TYPE } from './content_types';
import { HtmlContextTypeConvert, TextContextTypeConvert } from './types';

const DEFAULT_CONTEXT_TYPE = TEXT_CONTEXT_TYPE;

export abstract class FieldFormat {
  /**
   * @property {string} - Field Format Id
   * @static
   * @public
   */
  static id: string;
  /**
   * @property {string} -  Field Format Title
   * @static
   * @public
   */
  static title: string;

  /**
   * @property {string} - Field Format Type
   * @private
   */
  static fieldType: string | string[];

  /**
   * @property {FieldFormatConvert}
   * @private
   * have to remove the private because of
   * https://github.com/Microsoft/TypeScript/issues/17293
   */
  convertObject: FieldFormatConvert | undefined;

  /**
   * @property {htmlConvert}
   * @protected
   * have to remove the protected because of
   * https://github.com/Microsoft/TypeScript/issues/17293
   */
  htmlConvert: HtmlContextTypeConvert | undefined;

  /**
   * @property {textConvert}
   * @protected
   * have to remove the protected because of
   * https://github.com/Microsoft/TypeScript/issues/17293
   */
  textConvert: TextContextTypeConvert | undefined;

  /**
   * @property {Function} - ref to child class
   * @private
   */
  public type: any = this.constructor;

  protected readonly _params: any;
  protected getConfig: FieldFormatsGetConfigFn | undefined;

  constructor(_params: IFieldFormatMetaParams = {}, getConfig?: FieldFormatsGetConfigFn) {
    this._params = _params;

    if (getConfig) {
      this.getConfig = getConfig;
    }
  }

  /**
   * Convert a raw value to a formatted string
   * @param  {any} value
   * @param  {string} [contentType=text] - optional content type, the only two contentTypes
   *                                currently supported are "html" and "text", which helps
   *                                formatters adjust to different contexts
   * @return {string} - the formatted string, which is assumed to be html, safe for
   *                    injecting into the DOM or a DOM attribute
   * @public
   */
  convert(
    value: any,
    contentType: FieldFormatsContentType = DEFAULT_CONTEXT_TYPE,
    options?: HtmlContextTypeOptions | TextContextTypeOptions
  ): string {
    const converter = this.getConverterFor(contentType);

    if (converter) {
      return converter.call(this, value, options);
    }

    return value;
  }

  /**
   * Get a convert function that is bound to a specific contentType
   * @param  {string} [contentType=text]
   * @return {function} - a bound converter function
   * @public
   */
  getConverterFor(
    contentType: FieldFormatsContentType = DEFAULT_CONTEXT_TYPE
  ): FieldFormatConvertFunction {
    if (!this.convertObject) {
      this.convertObject = this.setupContentType();
    }

    return this.convertObject[contentType];
  }

  /**
   * Get parameter defaults
   * @return {object} - parameter defaults
   * @public
   */
  getParamDefaults(): Record<string, any> {
    return {};
  }

  /**
   * Get the value of a param. This value may be a default value.
   *
   * @param  {string} name - the param name to fetch
   * @return {any}
   * @public
   */
  param(name: string): any {
    const val = get(this._params, name);

    if (val || val === false || val === 0) {
      // truthy, false, or 0 are fine
      // '', NaN, null, undefined, etc are not
      return val;
    }

    return get(this.getParamDefaults(), name);
  }

  /**
   * Get all of the params in a single object
   * @return {object}
   * @public
   */
  params(): Record<string, any> {
    return cloneDeep(defaults({}, this._params, this.getParamDefaults()));
  }

  /**
   * Serialize this format to a simple POJO, with only the params
   * that are not default
   *
   * @return {object}
   * @public
   */
  toJSON() {
    const id = get(this.type, 'id');
    const defaultsParams = this.getParamDefaults() || {};

    const params = transform(
      this._params,
      (uniqParams: any, val, param) => {
        if (param && val !== get(defaultsParams, param)) {
          uniqParams[param] = val;
        }
      },
      {}
    );

    return {
      id,
      params: size(params) ? params : undefined,
    };
  }

  static from(convertFn: FieldFormatConvertFunction): FieldFormatInstanceType {
    return createCustomFieldFormat(convertFn);
  }

  setupContentType(): FieldFormatConvert {
    return {
      text: textContentTypeSetup(this, this.textConvert),
      html: htmlContentTypeSetup(this, this.htmlConvert),
    };
  }

  static isInstanceOfFieldFormat(fieldFormat: any): fieldFormat is FieldFormat {
    return Boolean(fieldFormat && fieldFormat.convert);
  }
}
