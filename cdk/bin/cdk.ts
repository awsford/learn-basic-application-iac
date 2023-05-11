#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ApplicationStack } from '../lib/application/application-stack';
import { NetworkStack } from '../lib/network/network-stack';

const app = new cdk.App();
const { vpc } = new NetworkStack(app, 'NetworkStack', {});
new ApplicationStack(app, 'ApplicationStack', { vpc: vpc });