/*
composite construct that sets up all resources
for org events handling
*/

import { ILayerVersion, Runtime } from "aws-cdk-lib/aws-lambda"; // Importing external resources in CDK would use interfaces and not base objects
import { SnsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { ITopic } from "aws-cdk-lib/aws-sns"; // Importing external resources in CDK would use interfaces and not base objects
import { Construct } from "constructs";
import { join } from "path";
import { BuildConfig } from "../build/buildConfig";

function name(buildConfig: BuildConfig, resourcename: string): string {
  return buildConfig.Environment + "-" + resourcename;
}

export interface OrgEventsProps {
  readonly linksTableName: string;
  readonly permissionSetArnTableName: string;
  readonly linkQueueUrl: string;
  readonly errorNotificationsTopicArn: string;
  readonly nodeJsLayer: ILayerVersion;
  readonly orgEventsNotificationTopic: ITopic;
  readonly listInstancesSSOAPIRoleArn: string;
  readonly listGroupsIdentityStoreAPIRoleArn: string;
  readonly provisionedlinksTableName: string;
}

export class OrgEvents extends Construct {
  public readonly orgEventsHandler: NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    buildConfig: BuildConfig,
    orgEventsProps: OrgEventsProps
  ) {
    super(scope, id);

    this.orgEventsHandler = new NodejsFunction(
      this,
      name(buildConfig, "orgEventsHandler"),
      {
        runtime: Runtime.NODEJS_16_X,
        functionName: name(buildConfig, "orgEventsHandler"),
        entry: join(
          __dirname,
          "../",
          "lambda-functions",
          "application-handlers",
          "src",
          "orgEvents.ts"
        ),
        bundling: {
          externalModules: [
            "@aws-sdk/client-sns",
            "@aws-sdk/client-dynamodb",
            "@aws-sdk/client-identitystore",
            "@aws-sdk/client-sso-admin",
            "@aws-sdk/credential-providers",
            "@aws-sdk/lib-dynamodb",
            "@aws-sdk/client-sqs",
            "uuid",
          ],
          minify: true,
        },
        layers: [orgEventsProps.nodeJsLayer],
        environment: {
          linkQueueUrl: orgEventsProps.linkQueueUrl,
          permissionSetArnTable: orgEventsProps.permissionSetArnTableName,
          DdbTable: orgEventsProps.linksTableName,
          errorNotificationsTopicArn: orgEventsProps.errorNotificationsTopicArn,
          adUsed: String(buildConfig.Parameters.IsAdUsed),
          domainName: buildConfig.Parameters.DomainName,
          SSOAPIRoleArn: orgEventsProps.listInstancesSSOAPIRoleArn,
          ISAPIRoleArn: orgEventsProps.listGroupsIdentityStoreAPIRoleArn,
          ssoRegion: buildConfig.PipelineSettings.SSOServiceAccountRegion,
          provisionedLinksTable: orgEventsProps.provisionedlinksTableName,
        },
      }
    );

    this.orgEventsHandler.addEventSource(
      new SnsEventSource(orgEventsProps.orgEventsNotificationTopic)
    );
  }
}
