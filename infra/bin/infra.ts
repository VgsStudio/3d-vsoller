#!/usr/bin/env node
import "dotenv/config";
import * as cdk from "aws-cdk-lib";
import { ThreeDStack } from "../lib/three-d-stack";

const app = new cdk.App();

const adminApiKey = process.env.ADMIN_API_KEY;
if (!adminApiKey) {
  throw new Error("ADMIN_API_KEY env var is required (see infra/.env)");
}

new ThreeDStack(app, "Vsoller3DStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
  siteDomain: "3d.vsoller.com.br",
  apiDomain: "api.3d.vsoller.com.br",
  parentZoneName: "vsoller.com.br",
  hostedZoneId: "Z02751983QMG471PEMGX6",
  adminApiKey,
});
