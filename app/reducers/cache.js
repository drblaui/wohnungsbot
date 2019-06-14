// @flow

import dotProp from 'dot-prop-immutable';
import type { Action } from './types';
import {
  MARK_COMPLETED,
  RESET_CACHE,
  SET_CACHE
} from '../constants/actionTypes';

export type BaseCacheEntry = {
  timestamp: number
};

export type ApplicationData = {
  flatId: string,
  success: boolean,
  addressDescription: string,
  reason?: string
};

export type Cache<T> = {
  [identifier: string]: BaseCacheEntry & T
};

export const CACHE_NAMES = {
  APPLICATIONS: 'applications',
  MAIL: 'mail'
};
export type CacheName = $Values<typeof CACHE_NAMES>;

export type cacheStateType = {
  applications: Cache<ApplicationData>,
  mail: Cache<any>
};

const cacheDefaultState: cacheStateType = {
  applications: {},
  mail: {}
};

export default function cache(
  state: cacheStateType = cacheDefaultState,
  action: Action
): cacheStateType {
  if (action.type === MARK_COMPLETED) {
    const { name, identifier, data } = action.payload;

    return dotProp.set(
      state,
      `${name}.${identifier}`,
      Object.assign({}, data, { timestamp: new Date().getTime() })
    );
  }

  if (action.type === SET_CACHE) {
    return action.payload.cache;
  }
  if (action.type === RESET_CACHE) {
    return cacheDefaultState;
  }

  return state;
}
