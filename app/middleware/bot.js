// @flow

import { electronRouting } from '../actions/electron';
import type { Action, Store } from '../reducers/types';
import { sleep } from '../utils/async';
import {
  RETURN_TO_SEARCH_PAGE,
  SET_BROWSER_VIEW_READY,
  SET_VERDICT
} from '../constants/actionTypes';
import { calculateOverviewBoundingBoxes } from '../actions/overlay';
import { getFlatData, getOverviewData, refreshVerdicts } from '../actions/data';
import { FLAT_ACTION } from '../reducers/data';
import { sendFlatViewingNotificationMail } from '../actions/email';
import { launchNextTask, queueInvestigateFlat } from '../actions/bot';
import {
  discardApplicationProcess,
  generateApplicationTextAndSubmit
} from '../actions/application';

export default (store: Store) => (next: (action: Action) => void) => async (
  action: Action
) => {
  if (action.type === RETURN_TO_SEARCH_PAGE) {
    store.dispatch(
      electronRouting('puppet', store.getState().configuration.searchUrl)
    );
  }

  if (action.type === SET_BROWSER_VIEW_READY) {
    if (action.payload.name === 'puppet' && action.payload.ready) {
      setImmediate(async () => {
        await sleep(5000);

        const { puppet } = store.getState().electron.views;
        if (puppet.url.startsWith('https://www.immobilienscout24.de/Suche')) {
          setImmediate(() => store.dispatch(calculateOverviewBoundingBoxes()));
          setTimeout(
            () => store.dispatch(calculateOverviewBoundingBoxes()),
            1000
          );
          setTimeout(
            () => store.dispatch(calculateOverviewBoundingBoxes()),
            5000
          );

          await store.dispatch(getOverviewData());
          await store.dispatch(refreshVerdicts());
          await sleep(20000);
          store.dispatch(launchNextTask());
        }

        if (puppet.url.startsWith('https://www.immobilienscout24.de/expose/')) {
          await store.dispatch(getFlatData());
          store.dispatch(refreshVerdicts());
        }
      });
    }
  }

  if (action.type === SET_VERDICT) {
    const { flatId, verdict } = action.payload;
    const {
      configuration: { contactData },
      data: { overview }
    } = store.getState();
    const flatOverview = overview[flatId];

    // eslint-disable-next-line default-case
    switch (verdict.action) {
      case FLAT_ACTION.NOTIFY_VIEWING_DATE:
        store.dispatch(
          sendFlatViewingNotificationMail(contactData, flatOverview)
        );
        break;
      case FLAT_ACTION.INVESTIGATE:
        store.dispatch(queueInvestigateFlat(flatId));
        break;
      case FLAT_ACTION.APPLY:
        store.dispatch(generateApplicationTextAndSubmit(flatId));
        break;
      case FLAT_ACTION.DISCARD:
        store.dispatch(discardApplicationProcess(flatOverview));

        break;
    }
  }

  return next(action);
};