/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actionLink from "../actionLink.js";
import type * as classify from "../classify.js";
import type * as constants from "../constants.js";
import type * as discover from "../discover.js";
import type * as drafts from "../drafts.js";
import type * as enrich from "../enrich.js";
import type * as lib_anthropic from "../lib/anthropic.js";
import type * as lib_apify from "../lib/apify.js";
import type * as lib_embeddings from "../lib/embeddings.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_openai_llm from "../lib/openai_llm.js";
import type * as lib_orangeslice from "../lib/orangeslice.js";
import type * as lib_reddit from "../lib/reddit.js";
import type * as lib_scoring from "../lib/scoring.js";
import type * as lib_skill from "../lib/skill.js";
import type * as lib_timing from "../lib/timing.js";
import type * as lib_token from "../lib/token.js";
import type * as mock from "../mock.js";
import type * as operators from "../operators.js";
import type * as opportunities from "../opportunities.js";
import type * as posts from "../posts.js";
import type * as products from "../products.js";
import type * as subreddits from "../subreddits.js";
import type * as targeting from "../targeting.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actionLink: typeof actionLink;
  classify: typeof classify;
  constants: typeof constants;
  discover: typeof discover;
  drafts: typeof drafts;
  enrich: typeof enrich;
  "lib/anthropic": typeof lib_anthropic;
  "lib/apify": typeof lib_apify;
  "lib/embeddings": typeof lib_embeddings;
  "lib/llm": typeof lib_llm;
  "lib/openai_llm": typeof lib_openai_llm;
  "lib/orangeslice": typeof lib_orangeslice;
  "lib/reddit": typeof lib_reddit;
  "lib/scoring": typeof lib_scoring;
  "lib/skill": typeof lib_skill;
  "lib/timing": typeof lib_timing;
  "lib/token": typeof lib_token;
  mock: typeof mock;
  operators: typeof operators;
  opportunities: typeof opportunities;
  posts: typeof posts;
  products: typeof products;
  subreddits: typeof subreddits;
  targeting: typeof targeting;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
