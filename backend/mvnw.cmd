@echo off
setlocal
set MAVEN_PROJECTBASEDIR=%~dp0
java -jar "%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar" %*
endlocal
