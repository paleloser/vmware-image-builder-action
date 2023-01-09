// eslint-disable-next-line filenames/match-regex
import * as core from "@actions/core"
import * as path from "path"
import ConfigurationFactory, {
  DEFAULT_BASE_FOLDER,
  DEFAULT_EXECUTION_GRAPH_GLOBAL_TIMEOUT,
  DEFAULT_PIPELINE_FILE,
} from "../src/config"

const STARTING_ENV = process.env
const root = path.join(__dirname, ".")
const configFactory = new ConfigurationFactory(root)

describe("Given a configuration", () => {
  beforeAll(async () => {
    jest.spyOn(core, "info").mockImplementation(msg => console.log("::info:: " + msg))
    jest.spyOn(core, "warning").mockImplementation(msg => console.log("::warning:: " + msg))
    jest.spyOn(core, "debug").mockImplementation(msg => console.log("::debug:: " + msg))
    jest.spyOn(core, "setFailed")
  })

  beforeEach(async () => {
    process.env = { ...STARTING_ENV }
  })

  it("When github sha is not present there will be no sha archive config property", async () => {
    const config = await configFactory.getConfiguration()

    expect(config.shaArchive).toBeUndefined()
  })

  it("When github repository is not present there will be no sha archive config property", async () => {
    process.env.GITHUB_SHA = "aacf48f14ed73e4b368ab66abf4742b0e9afae54"

    const config = await configFactory.getConfiguration()

    expect(config.shaArchive).toBeUndefined()
  })

  it("When both github sha and repository are present then there will be sha archive config property set", async () => {
    process.env.GITHUB_SHA = "aacf48f14ed73e4b368ab66abf4742b0e9afae54"
    process.env.GITHUB_REPOSITORY = "vmware/vib-action"

    const config = await configFactory.getConfiguration()

    expect(config.shaArchive).toBeDefined()
    expect(config.shaArchive).toEqual(
      `https://github.com/vmware/vib-action/archive/aacf48f14ed73e4b368ab66abf4742b0e9afae54.zip`
    )
  })

  it("Loads event configuration from the environment path", async () => {
    process.env.GITHUB_EVENT_PATH = path.join(root, "github-event-path.json")

    const config = await configFactory.getConfiguration()

    expect(config.shaArchive).toBe("https://api.github.com/repos/mpermar/vib-action-test/tarball/a-new-branch")
  })

  it("When event configuration exists SHA archive variable is set from its data", async () => {
    process.env.GITHUB_SHA = "aacf48f14ed73e4b368ab66abf4742b0e9afae54"
    process.env.GITHUB_REPOSITORY = "vmware/vib-action"
    process.env.GITHUB_EVENT_PATH = path.join(root, "github-event-path.json") // overseeds the previous two env vars

    const config = await configFactory.getConfiguration()

    expect(config.shaArchive).toEqual("https://api.github.com/repos/mpermar/vib-action-test/tarball/a-new-branch")
  })

  it("When push from branch and no SHA archive variable is set then sha is picked from ref env", async () => {
    process.env.GITHUB_REF_NAME = "martinpe-patch-1" // this is what rules
    process.env.GITHUB_EVENT_PATH = path.join(root, "github-event-path-branch.json") // still will use env var above

    const config = await configFactory.getConfiguration()

    expect(config.shaArchive).toEqual("https://github.com/mpermar/vib-action-test/tarball/martinpe-patch-1")
  })

  it("When push from branch and both SHA archive and REF are set then sha is picked from SHA env", async () => {
    process.env.GITHUB_SHA = "aacf48f14ed73e4b368ab66abf4742b0e9afae54" // this will be ignored
    process.env.GITHUB_REF_NAME = "martinpe-patch-1" // this is what rules
    process.env.GITHUB_EVENT_PATH = path.join(root, "github-event-path-branch.json") // still will use env var above

    const config = await configFactory.getConfiguration()

    expect(config.shaArchive).toEqual(
      "https://github.com/mpermar/vib-action-test/tarball/aacf48f14ed73e4b368ab66abf4742b0e9afae54"
    )
  })

  it("When triggered from a scheduled job, GitHub Action still gets an archive to download", async () => {
    process.env.GITHUB_REPOSITORY = "vmware/vib-action"
    process.env.GITHUB_SERVER_URL = "https://github.com"
    process.env.GITHUB_REF_NAME = "martinpe-patch-1"
    process.env.GITHUB_EVENT_PATH = path.join(root, "github-event-scheduled.json")

    const config = await configFactory.getConfiguration()

    expect(config.shaArchive).toEqual("https://github.com/vmware/vib-action/tarball/martinpe-patch-1")
  })

  it("Default base folder is used when not customized", async () => {
    const config = await configFactory.getConfiguration()

    expect(config.baseFolder).toEqual(DEFAULT_BASE_FOLDER)
  })

  it("Default base folder is not used when customized", async () => {
    const expectedInputconfig = ".vib-other"
    process.env["INPUT_CONFIG"] = expectedInputconfig

    const config = await configFactory.getConfiguration()

    expect(config.baseFolder).toEqual(expectedInputconfig)
  })

  it("Default pipeline is used when not customized", async () => {
    const config = await configFactory.getConfiguration()

    expect(config.pipeline).toEqual(DEFAULT_PIPELINE_FILE)
  })

  it("Default pipeline duration is used when not customized", async () => {
    const config = await configFactory.getConfiguration()

    expect(config.pipelineDuration).toEqual(DEFAULT_EXECUTION_GRAPH_GLOBAL_TIMEOUT * 1000)
  })

  it("Passed pipeline duration is used when customized", async () => {
    const expectedMaxDuration = 3333
    process.env["INPUT_MAX-PIPELINE-DURATION"] = "" + expectedMaxDuration

    const config = await configFactory.getConfiguration()

    expect(config.pipelineDuration).toEqual(expectedMaxDuration * 1000)
  })

  it("If file does not exist, throw an error", async () => {
    process.env["INPUT_PIPELINE"] = "wrong.json"

    await configFactory.getConfiguration()

    expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining("Could not find pipeline"))
  })

  it("If verification mode has not a valid value the default is used", async () => {
    const wrongVerificationMode = "WHATEVER"
    process.env["INPUT_VERIFICATION-MODE"] = wrongVerificationMode

    await configFactory.getConfiguration()

    expect(core.warning).toHaveBeenCalledWith(
      `The value ${wrongVerificationMode} for verification-mode is not valid, the default value will be used.`
    )
  })

  it("Passed verification mode is used when customized", async () => {
    const expectedVerificationMode = "SERIAL"
    process.env["INPUT_VERIFICATION-MODE"] = expectedVerificationMode

    const config = await configFactory.getConfiguration()

    expect(config.verificationMode.toString()).toEqual(expectedVerificationMode)
  })
})
