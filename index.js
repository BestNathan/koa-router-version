'use strict';

const semver = require('semver');

const defaultOptions = {
  requestHeader: 'Accept-Version',
  responseHeader: 'X-Api-Version',
  routeParam: 'version',
  fallbackLatest: false,
  defaultVersion: null,
};

// sort by version from larger to smaller
const sorter = (a, b) => {
  a = a.version;
  b = b.version;

  return semver.lt(a, b) ? 1 : -1;
};

function findMiddlewareWithVersion(version, tuples, fallbackLatest = false) {
  // if `version` is null or accept all then return the latest
  if (version === null || version === '*') {
    return tuples[0];
  }

  // iterate and test version to match
  for (const tuple of tuples) {
    if (semver.satisfies(tuple.version, version)) {
      return tuple;
    }
  }

  // fallback latest
  if (fallbackLatest) {
    return tuples[0];
  }

  return null;
}

function version(versions, options = {}) {
  // make new opt and override default options
  const opt = Object.assign({}, defaultOptions, options);

  // store different versions' middleware and sort for `opt.fallbackLatest`
  const middlewareTuples = [];
  for (const version in versions) middlewareTuples.push({version, middleware: versions[version]});
  middlewareTuples.sort(sorter);

  // router version middleware
  return (ctx, next) => {
    const {
      requestHeader,
      responseHeader,
      routeParam,
      fallbackLatest,
      defaultVersion,
    } = opt;
    let requestedVersion = null;

    if (
      routeParam !== '' &&
      ctx.params.hasOwnProperty(routeParam) &&
      typeof ctx.params[routeParam] === 'string'
    ) {
      // get version to match from `params`
      requestedVersion = ctx.params[routeParam].substr(1);
    } else {
      // get version to match from `header`
      requestedVersion = ctx.get(requestHeader) || null;
    }

    // if not find any version to match
    // then use defaultVersion
    if (!requestedVersion && defaultVersion) {
      requestedVersion = defaultVersion;
    }

    // find version matched
    const found = findMiddlewareWithVersion(requestedVersion, middlewareTuples, fallbackLatest);
    if (found) {
      const {
        version,
        middleware,
      } = found;

      // set to state
      ctx.state.apiVersion = version;

      // set response header
      ctx.set(responseHeader, version);

      return middleware(ctx, next);
    }

    // not found or match then throw
    ctx.throw(400, 'Version ' + requestedVersion + ' is not supported');
  };
}

module.exports = {
  defaultOptions,
  version,
};